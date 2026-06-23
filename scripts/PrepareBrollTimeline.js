const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const configPath = process.argv[2];
if (!configPath) throw new Error("Usage: node PrepareBrollTimeline.js <config.json>");

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const outputPath = path.resolve(config.outputPath);
const tempDir = path.join(path.dirname(outputPath), "_compose", path.basename(outputPath, path.extname(outputPath)));
fs.mkdirSync(tempDir, { recursive: true });

function run(args) {
  execFileSync("ffmpeg", args, { stdio: "inherit" });
}

function normalizedPath(index, clip) {
  const zoom = Math.round(Number(clip.zoom || 1) * 100);
  const duration = Math.round(Number(clip.duration || 0) * 1000);
  return path.join(tempDir, `clip_${String(index + 1).padStart(4, "0")}_z${String(zoom).padStart(3, "0")}_d${String(duration).padStart(5, "0")}.mp4`);
}

const normalized = config.clips.map((clip, index) => {
  const output = normalizedPath(index, clip);
  if (fs.existsSync(output) && fs.statSync(output).size > 1024) return output;
  const zoom = Number(clip.zoom || 1);
  const scale = zoom > 1
    ? `scale=ceil(iw*${zoom}/2)*2:ceil(ih*${zoom}/2)*2,crop=1920:1080`
    : "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080";
  run([
    "-hide_banner", "-loglevel", "error", "-y", "-i", path.resolve(clip.path),
    "-t", Number(clip.duration).toFixed(3), "-an", "-map", "0:v:0",
    "-vf", `${scale},setsar=1,fps=30,format=yuv420p`,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p", output,
  ]);
  return output;
});

const concatPath = path.join(tempDir, "concat.txt");
fs.writeFileSync(concatPath, normalized.map((item) => `file '${item.replace(/'/g, "'\\''")}'`).join("\n"), "utf8");
const timelinePath = path.join(tempDir, "timeline-joined.mp4");
run(["-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", concatPath, "-c", "copy", "-movflags", "+faststart", timelinePath]);

console.log(JSON.stringify({ tempDir, clips: normalized.length, timelinePath }, null, 2));
