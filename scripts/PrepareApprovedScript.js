const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const source = process.argv[2];
const approve = process.argv.includes("--approve");

if (!source) {
  throw new Error("Usage: node scripts/PrepareApprovedScript.js <script.txt> [--approve]");
}

const absoluteSource = path.resolve(source);
const approved = path.join(process.cwd(), "dy-creator", "script-qc", "approved", path.basename(absoluteSource));
const pronunciationReport = path.join(
  process.cwd(),
  "dy-creator",
  "script-qc",
  "reports",
  `${path.basename(absoluteSource, path.extname(absoluteSource))}-pronunciation-report.md`
);

if (!approve && fs.existsSync(approved)) {
  console.log(JSON.stringify({ status: "approved", scriptPath: approved }, null, 2));
  process.exit(0);
}

const args = ["scripts/CheckScriptQuality.js", absoluteSource];
if (approve) args.push("--approve");
const result = spawnSync(process.execPath, args, { cwd: process.cwd(), encoding: "utf8" });
process.stdout.write(result.stdout || "");
process.stderr.write(result.stderr || "");

if (result.status !== 0) process.exit(result.status || 1);

const pronunciation = spawnSync(
  process.execPath,
  ["scripts/CheckPolyphonicWords.js", absoluteSource, pronunciationReport],
  { cwd: process.cwd(), encoding: "utf8" }
);
process.stdout.write(pronunciation.stdout || "");
process.stderr.write(pronunciation.stderr || "");
if (pronunciation.status !== 0) process.exit(pronunciation.status || 1);
if (!approve) {
  console.error("Script and pronunciation QC reports generated. Review and rerun with --approve before TTS.");
  process.exit(2);
}

console.log(JSON.stringify({ status: "approved", scriptPath: approved }, null, 2));
