const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const clipsDir = process.argv[2];
const sourcePath = process.argv[3] || "";
const outputPath = process.argv[4] || path.join(clipsDir || ".", "manifest.csv");

if (!clipsDir) {
  console.error("Usage: node scripts/BuildClipManifest.js <clipsDir> [sourcePath] [outputManifest]");
  process.exit(1);
}

function duration(filePath) {
  const result = spawnSync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=nk=1:nw=1",
    filePath,
  ], { encoding: "utf8" });

  if (result.status !== 0) return "";
  return Number(result.stdout.trim()).toFixed(3);
}

const files = fs.readdirSync(clipsDir)
  .filter((name) => /\.(mp4|mov|mkv)$/i.test(name))
  .sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));

const rows = [
  ["file", "source", "duration", "tags", "scene", "emotion", "action", "notes"],
];

for (const file of files) {
  const fullPath = path.resolve(clipsDir, file);
  rows.push([
    fullPath,
    sourcePath ? path.resolve(sourcePath) : "",
    duration(fullPath),
    "",
    "",
    "",
    "",
    "auto scene split",
  ]);
}

fs.writeFileSync(
  outputPath,
  rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n"),
  "utf8"
);

console.log(JSON.stringify({
  clipsDir: path.resolve(clipsDir),
  outputPath: path.resolve(outputPath),
  clips: files.length,
}, null, 2));
