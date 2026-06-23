const path = require("path");
const {
  DEFAULT_LEDGER_PATH,
  clipsFromConfig,
  registerClips,
} = require("./ClipUsagePolicy");

const configPath = process.argv[2];
const videoName = process.argv[3] || (configPath ? path.basename(configPath, path.extname(configPath)) : "");
const ledgerPath = process.argv[4] || DEFAULT_LEDGER_PATH;

if (!configPath || !videoName) {
  console.error("Usage: node scripts/RegisterClipUsage.js <video-config.json> <videoName> [ledgerPath]");
  process.exit(1);
}

const clips = clipsFromConfig(configPath);
const result = registerClips(videoName, clips, { ledgerPath });

console.log(JSON.stringify({
  ledgerPath,
  videoName,
  videoIndex: result.videoIndex,
  clipCount: result.clipCount,
  nextVideoIndex: result.ledger.nextVideoIndex,
}, null, 2));
