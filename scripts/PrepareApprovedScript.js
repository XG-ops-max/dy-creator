const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const source = process.argv[2];
const projectDir = process.argv[3] || process.cwd();
const approve = process.argv.includes("--approve");

if (!source) {
  throw new Error("Usage: node scripts/PrepareApprovedScript.js <script.txt> [projectDir] [--approve]");
}

const absoluteSource = path.resolve(source);
const stateDir = path.resolve(projectDir, "dy-creator-state", "qc");
const reportPath = path.join(
  stateDir,
  "reports",
  `${path.basename(absoluteSource, path.extname(absoluteSource))}-report.md`
);
const approvedPath = path.join(stateDir, "approved", path.basename(absoluteSource));

if (!approve && fs.existsSync(approvedPath)) {
  console.log(JSON.stringify({ status: "approved", scriptPath: approvedPath }, null, 2));
  process.exit(0);
}

const qualityScript = path.join(__dirname, "CheckScriptQuality.js");
const result = spawnSync(process.execPath, [qualityScript, absoluteSource, reportPath], {
  encoding: "utf8",
});
process.stdout.write(result.stdout || "");
process.stderr.write(result.stderr || "");
if (result.status !== 0) process.exit(result.status || 1);

if (!approve) {
  console.error("Script QC report generated. Review it and rerun with --approve before TTS.");
  process.exit(2);
}

fs.mkdirSync(path.dirname(approvedPath), { recursive: true });
fs.copyFileSync(absoluteSource, approvedPath);
console.log(JSON.stringify({ status: "approved", scriptPath: approvedPath, reportPath }, null, 2));
