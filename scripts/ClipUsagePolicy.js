const fs = require("fs");
const path = require("path");

const DEFAULT_LEDGER_PATH = path.join(process.cwd(), "dy-creator", "clip-usage-ledger.json");
const DEFAULT_COOLDOWN_VIDEOS = 2;

function normalizeClipPath(filePath) {
  return path.resolve(filePath).replace(/\\/g, "/").toLowerCase();
}

function emptyLedger() {
  return {
    version: 1,
    cooldownVideos: DEFAULT_COOLDOWN_VIDEOS,
    nextVideoIndex: 1,
    videos: [],
    clips: {},
  };
}

function loadLedger(ledgerPath = DEFAULT_LEDGER_PATH) {
  if (!fs.existsSync(ledgerPath)) return emptyLedger();
  return { ...emptyLedger(), ...JSON.parse(fs.readFileSync(ledgerPath, "utf8")) };
}

function saveLedger(ledger, ledgerPath = DEFAULT_LEDGER_PATH) {
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2), "utf8");
}

function currentVideoIndex(ledger) {
  return Math.max(1, Number(ledger.nextVideoIndex || 1));
}

function isClipEligible(filePath, options = {}) {
  const ledger = options.ledger || loadLedger(options.ledgerPath);
  const cooldownVideos = Number(options.cooldownVideos ?? ledger.cooldownVideos ?? DEFAULT_COOLDOWN_VIDEOS);
  const clipKey = normalizeClipPath(filePath);
  const usage = ledger.clips[clipKey];
  if (!usage) return true;

  const distance = currentVideoIndex(ledger) - Number(usage.lastUsedVideoIndex || 0);
  return distance > cooldownVideos;
}

function clipBlockReason(filePath, options = {}) {
  const ledger = options.ledger || loadLedger(options.ledgerPath);
  const cooldownVideos = Number(options.cooldownVideos ?? ledger.cooldownVideos ?? DEFAULT_COOLDOWN_VIDEOS);
  const clipKey = normalizeClipPath(filePath);
  const usage = ledger.clips[clipKey];
  if (!usage) return null;

  const distance = currentVideoIndex(ledger) - Number(usage.lastUsedVideoIndex || 0);
  if (distance > cooldownVideos) return null;

  return {
    lastUsedVideoIndex: usage.lastUsedVideoIndex,
    lastUsedVideoName: usage.lastUsedVideoName,
    currentVideoIndex: currentVideoIndex(ledger),
    cooldownVideos,
    remainingVideos: cooldownVideos - distance + 1,
  };
}

function registerClips(videoName, clips, options = {}) {
  const ledgerPath = options.ledgerPath || DEFAULT_LEDGER_PATH;
  const ledger = loadLedger(ledgerPath);
  const videoIndex = currentVideoIndex(ledger);
  const now = new Date().toISOString();
  const uniqueClips = [...new Set(clips.map(normalizeClipPath))];

  ledger.videos.push({
    videoIndex,
    videoName,
    registeredAt: now,
    clipCount: uniqueClips.length,
    sourceSequence: Array.isArray(options.sourceSequence) ? options.sourceSequence : [],
  });

  for (const clipKey of uniqueClips) {
    ledger.clips[clipKey] = {
      lastUsedVideoIndex: videoIndex,
      lastUsedVideoName: videoName,
      lastUsedAt: now,
      useCount: (ledger.clips[clipKey]?.useCount || 0) + 1,
    };
  }

  ledger.nextVideoIndex = videoIndex + 1;
  saveLedger(ledger, ledgerPath);
  return { ledger, videoIndex, clipCount: uniqueClips.length };
}

function clipsFromConfig(configPath) {
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  return (config.clips || [])
    .map((clip) => clip.path)
    .filter(Boolean);
}

module.exports = {
  DEFAULT_COOLDOWN_VIDEOS,
  DEFAULT_LEDGER_PATH,
  normalizeClipPath,
  loadLedger,
  saveLedger,
  isClipEligible,
  clipBlockReason,
  registerClips,
  clipsFromConfig,
};
