const path = require("path");
const {
  DEFAULT_LEDGER_PATH,
  clipBlockReason,
  clipsFromConfig,
} = require("./ClipUsagePolicy");

const configPath = process.argv[2];
const ledgerPath = process.argv[3] || DEFAULT_LEDGER_PATH;

if (!configPath) {
  console.error("Usage: node scripts/CheckClipReuse.js <video-config.json> [ledgerPath]");
  process.exit(1);
}

const clips = clipsFromConfig(configPath);
const blocked = [];

for (const clip of clips) {
  const reason = clipBlockReason(clip, { ledgerPath });
  if (reason) {
    blocked.push({
      clip: path.relative(process.cwd(), clip),
      ...reason,
    });
  }
}

console.log(JSON.stringify({
  configPath,
  ledgerPath,
  checked: clips.length,
  blocked: blocked.length,
  blockedClips: blocked,
}, null, 2));

if (blocked.length > 0) {
  process.exitCode = 2;
}
