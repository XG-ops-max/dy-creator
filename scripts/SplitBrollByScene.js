const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const inputPath = process.argv[2];
const outputDir = process.argv[3];
const limitSeconds = Number(process.argv[4] || 600);
const threshold = Number(process.argv[5] || 0.35);
const minClipSeconds = Number(process.argv[6] || 2.0);
const maxClipSeconds = Number(process.argv[7] || 0);

if (!inputPath || !outputDir) {
  console.error("Usage: node scripts/SplitBrollByScene.js <inputVideo> <outputDir> [limitSeconds] [threshold] [minClipSeconds] [maxClipSeconds]");
  console.error("Set limitSeconds=0 to process the full video. Set maxClipSeconds=0 to keep whole detected shots.");
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 64,
    ...options,
  });

  if (result.status !== 0) {
    const message = [
      `${command} failed with exit code ${result.status}`,
      result.stdout,
      result.stderr,
    ].filter(Boolean).join("\n");
    throw new Error(message);
  }

  return result;
}

function ffprobeDuration(filePath) {
  const result = run("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=nk=1:nw=1",
    filePath,
  ]);
  return Number(result.stdout.trim());
}

function detectSceneCuts(filePath, durationLimit, sceneThreshold) {
  const args = [
    "-hide_banner",
    "-i", filePath,
  ];

  if (durationLimit > 0) {
    args.push("-t", String(durationLimit));
  }

  args.push(
    "-vf", `select=gt(scene\\,${sceneThreshold}),showinfo`,
    "-an",
    "-f", "null",
    "-"
  );

  const result = spawnSync("ffmpeg", args, {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 128,
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || `ffmpeg scene detection failed with exit code ${result.status}`);
  }

  const times = [];
  const regex = /pts_time:([0-9.]+)/g;
  let match;
  while ((match = regex.exec(result.stderr)) !== null) {
    const value = Number(match[1]);
    if (Number.isFinite(value)) {
      times.push(value);
    }
  }

  return [...new Set(times)].sort((a, b) => a - b);
}

function detectBlackRanges(filePath, durationLimit) {
  const args = [
    "-hide_banner",
    "-i", filePath,
  ];

  if (durationLimit > 0) {
    args.push("-t", String(durationLimit));
  }

  args.push(
    "-vf", "blackdetect=d=0.25:pix_th=0.10",
    "-an",
    "-f", "null",
    "-"
  );

  const result = spawnSync("ffmpeg", args, {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 128,
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || `ffmpeg black detection failed with exit code ${result.status}`);
  }

  const ranges = [];
  const regex = /black_start:([0-9.]+)\s+black_end:([0-9.]+)\s+black_duration:([0-9.]+)/g;
  let match;
  while ((match = regex.exec(result.stderr)) !== null) {
    ranges.push({
      start: Number(match[1]),
      end: Number(match[2]),
      duration: Number(match[3]),
    });
  }

  return ranges.filter((range) => (
    Number.isFinite(range.start)
    && Number.isFinite(range.end)
    && Number.isFinite(range.duration)
    && range.end > range.start
  ));
}

function overlapSeconds(aStart, aEnd, bStart, bEnd) {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

function isMostlyBlack(clip, blackRanges) {
  const clipStart = clip.start;
  const clipEnd = clip.start + clip.duration;
  const blackDuration = blackRanges.reduce((total, range) => (
    total + overlapSeconds(clipStart, clipEnd, range.start, range.end)
  ), 0);

  return blackDuration >= Math.min(clip.duration * 0.6, clip.duration - 0.25);
}

function trimBlackEdges(clip, blackRanges, minLen) {
  let start = clip.start;
  let end = clip.start + clip.duration;
  const epsilon = 0.12;

  for (const range of blackRanges) {
    if (range.start <= start + epsilon && range.end > start + epsilon && range.end < end) {
      start = range.end;
    }

    if (range.start > start && range.start < end - epsilon && range.end >= end - epsilon) {
      end = range.start;
    }
  }

  const duration = end - start;
  if (duration < minLen) {
    return null;
  }

  return { start, duration };
}

function makeClipPlan(cutTimes, totalDuration, minLen, maxLen) {
  const bounds = [0, ...cutTimes.filter((time) => time > 0 && time < totalDuration), totalDuration];
  const plan = [];

  for (let i = 0; i < bounds.length - 1; i++) {
    const start = bounds[i];
    const end = bounds[i + 1];
    const duration = end - start;

    if (duration < minLen) {
      continue;
    }

    if (maxLen <= 0 || duration <= maxLen) {
      plan.push({ start, duration });
      continue;
    }

    let cursor = start;
    while (cursor + minLen <= end) {
      const chunkDuration = Math.min(maxLen, end - cursor);
      if (chunkDuration >= minLen) {
        plan.push({ start: cursor, duration: chunkDuration });
      }
      cursor += maxLen;
    }
  }

  return plan;
}

function timestamp(seconds) {
  return seconds.toFixed(3);
}

function csvRow(row) {
  return row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",");
}

function main() {
  const fullInput = path.resolve(inputPath);
  const fullOutput = path.resolve(outputDir);
  fs.mkdirSync(fullOutput, { recursive: true });

  const sourceDuration = ffprobeDuration(fullInput);
  const workingDuration = Math.min(sourceDuration, limitSeconds > 0 ? limitSeconds : sourceDuration);
  const blackRanges = detectBlackRanges(fullInput, workingDuration);
  const cutTimes = detectSceneCuts(fullInput, workingDuration, threshold);
  const rawPlan = makeClipPlan(cutTimes, workingDuration, minClipSeconds, maxClipSeconds);
  const plan = rawPlan
    .map((clip) => trimBlackEdges(clip, blackRanges, minClipSeconds))
    .filter(Boolean)
    .filter((clip) => !isMostlyBlack(clip, blackRanges));

  const manifestRows = [
    ["file", "source", "start", "duration", "tags", "scene", "emotion", "action", "notes"],
  ];
  const manifestPath = path.join(fullOutput, "manifest.csv");
  fs.writeFileSync(manifestPath, csvRow(manifestRows[0]) + "\n", "utf8");

  plan.forEach((clip, index) => {
    const clipName = `clip_${String(index + 1).padStart(4, "0")}.mp4`;
    const clipPath = path.join(fullOutput, clipName);

    if (!fs.existsSync(clipPath) || fs.statSync(clipPath).size === 0) {
      run("ffmpeg", [
        "-hide_banner",
        "-y",
        "-ss", timestamp(clip.start),
        "-t", timestamp(clip.duration),
        "-i", fullInput,
        "-map", "0:v:0",
        "-an",
        "-vf", "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1,fps=30",
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-crf", "26",
        "-pix_fmt", "yuv420p",
        clipPath,
      ], { stdio: "pipe" });
    }

    const row = [
      clipPath,
      fullInput,
      timestamp(clip.start),
      timestamp(clip.duration),
      "",
      "",
      "",
      "",
      "auto scene split",
    ];

    manifestRows.push(row);
    fs.appendFileSync(manifestPath, csvRow(row) + "\n", "utf8");
  });

  console.log(JSON.stringify({
    input: fullInput,
    outputDir: fullOutput,
    sourceDuration,
    processedDuration: workingDuration,
    threshold,
    blackRanges: blackRanges.length,
    detectedCuts: cutTimes.length,
    plannedClips: rawPlan.length,
    skippedBlackClips: rawPlan.length - plan.length,
    exportedClips: plan.length,
    manifestPath,
  }, null, 2));
}

main();
