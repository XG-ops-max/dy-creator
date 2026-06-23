const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const configPath = process.argv[2];
if (!configPath) {
  throw new Error("Usage: node scripts/ComposeV2TwoStage.js <config.json>");
}

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const required = ["timelinePath", "voicePath", "subtitlePath", "outputPath", "bgmPath"];
for (const field of required) {
  if (!config[field]) throw new Error(`Config is missing ${field}.`);
}
if (!Number.isFinite(Number(config.bgmStartSec)) || Number(config.bgmStartSec) < 0) {
  throw new Error("Config must include non-negative bgmStartSec from the aligned first complete sentence end.");
}

function run(args) {
  execFileSync("ffmpeg", ["-hide_banner", "-y", ...args], { stdio: "inherit" });
}

function duration(filePath) {
  return Number(execFileSync("ffprobe", [
    "-v", "error", "-show_entries", "format=duration", "-of", "default=nk=1:nw=1", filePath,
  ], { encoding: "utf8" }).trim());
}

function ffmpegPath(filePath) {
  return path.resolve(filePath).replace(/\\/g, "/").replace(":", "\\:").replace(/'/g, "\\'");
}

const outputPath = path.resolve(config.outputPath);
const tempDir = path.resolve(config.tempDir || path.join(path.dirname(outputPath), "_compose", path.basename(outputPath, path.extname(outputPath))));
fs.mkdirSync(tempDir, { recursive: true });

const voicePath = path.resolve(config.voicePath);
const totalDuration = duration(voicePath);
const bgmStartSec = Math.min(Number(config.bgmStartSec), totalDuration);
const musicDuration = Math.max(0.1, totalDuration - bgmStartSec);
const fadeIn = Number(config.bgmFadeInSec ?? 0.5);
const fadeOut = Math.min(Number(config.bgmFadeOutSec ?? 0.9), musicDuration);
const videoOnly = path.join(tempDir, "video-only.mp4");
const mixedAudio = path.join(tempDir, "mixed-audio.m4a");
const fontsDir = config.fontsDir ? `:fontsdir='${ffmpegPath(config.fontsDir)}'` : "";
const opacity = Math.max(0, Math.min(1, Number(config.videoOpacity ?? 0.7)));
const subtitleFilter = `subtitles='${ffmpegPath(config.subtitlePath)}'${fontsDir}`;
const videoFilter = opacity < 1
  ? `[0:v]format=rgba,colorchannelmixer=aa=${opacity.toFixed(3)}[fg];color=c=black:s=1920x1080:r=30:d=${totalDuration.toFixed(3)}[bg];[bg][fg]overlay=0:0:format=auto[base];[base]${subtitleFilter},format=yuv420p[v]`
  : `[0:v]${subtitleFilter},format=yuv420p[v]`;

run([
  "-i", path.resolve(config.timelinePath), "-t", totalDuration.toFixed(3),
  "-filter_complex", videoFilter, "-map", "[v]", "-an", "-c:v", config.videoCodec || "libx264",
  "-preset", config.preset || "veryfast", "-crf", String(config.crf ?? 21),
  "-pix_fmt", "yuv420p", "-movflags", "+faststart", videoOnly,
]);

const voiceVolume = Number(config.voiceVolume ?? 2.0);
const bgmVolume = Number(config.bgmVolume ?? 0.3);
const audioFilter = [
  `[0:a]volume=${voiceVolume}[voice]`,
  `anullsrc=r=44100:cl=stereo,atrim=duration=${bgmStartSec.toFixed(3)}[silence]`,
  `[1:a]volume=${bgmVolume},atrim=duration=${musicDuration.toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=${fadeIn.toFixed(3)},afade=t=out:st=${Math.max(0, musicDuration - fadeOut).toFixed(3)}:d=${fadeOut.toFixed(3)}[music]`,
  "[silence][music]concat=n=2:v=0:a=1[bed]",
  "[voice][bed]amix=inputs=2:duration=first:normalize=0:dropout_transition=0[mix]",
].join(";");

run([
  "-i", voicePath, "-stream_loop", "-1", "-i", path.resolve(config.bgmPath),
  "-filter_complex", audioFilter, "-map", "[mix]", "-t", totalDuration.toFixed(3),
  "-c:a", "aac", "-b:a", config.audioBitrate || "192k", mixedAudio,
]);

run([
  "-i", videoOnly, "-i", mixedAudio,
  "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "copy", "-shortest", "-movflags", "+faststart", outputPath,
]);

console.log(JSON.stringify({ outputPath, totalDuration, bgmStartSec, videoOnly, mixedAudio }, null, 2));
