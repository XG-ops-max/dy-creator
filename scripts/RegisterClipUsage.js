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

const config = JSON.parse(require("fs").readFileSync(configPath, "utf8"));
const clips = clipsFromConfig(configPath);
const sourceSequence = (config.clips || [])
  .map((clip) => clip.sourceKeyword)
  .filter(Boolean);
const result = registerClips(videoName, clips, { ledgerPath, sourceSequence });

console.log(JSON.stringify({
  ledgerPath,
  videoName,
  videoIndex: result.videoIndex,
  clipCount: result.clipCount,
  sourceSequenceCount: sourceSequence.length,
  nextVideoIndex: result.ledger.nextVideoIndex,
}, null, 2));
