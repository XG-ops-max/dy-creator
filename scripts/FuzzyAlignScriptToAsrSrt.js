const fs = require("fs");
const path = require("path");

const asrSrt = process.argv[2];
const scriptPath = process.argv[3];
const outputSrt = process.argv[4];

if (!asrSrt || !scriptPath || !outputSrt) {
  console.error("Usage: node scripts/FuzzyAlignScriptToAsrSrt.js <asr.srt> <script.txt> <output.srt>");
  process.exit(1);
}

function parseSrt(raw) {
  return raw.replace(/\uFEFF/g, "")
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split(/\r?\n/);
      const time = lines.find((line) => line.includes("-->"));
      const timeIndex = lines.findIndex((line) => line.includes("-->"));
      return {
        time,
        text: lines.slice(timeIndex + 1).join(""),
      };
    })
    .filter((cue) => cue.time);
}

function canonical(text) {
  return text
    .replace(/两百|二百/g, "200")
    .replace(/五/g, "5")
    .replace(/四/g, "4")
    .replace(/八十/g, "80")
    .replace(/ＡＰＰ|APP|App/g, "app")
    .toLowerCase();
}

function normalizeChar(char) {
  const normalized = canonical(char);
  if (/[\u4e00-\u9fffA-Za-z0-9%％]/.test(normalized)) return normalized;
  return "";
}

function buildIndex(text) {
  const chars = [];
  const canonicalText = canonical(text);
  for (let index = 0; index < canonicalText.length; index += 1) {
    const normalized = normalizeChar(canonicalText[index]);
    if (normalized) chars.push({ normalized, sourceIndex: index });
  }
  return {
    normalized: chars.map((item) => item.normalized).join(""),
    chars,
  };
}

function normalizeText(text) {
  let output = "";
  for (const char of canonical(text)) output += normalizeChar(char);
  return output;
}

function editDistance(a, b, maxCost = Infinity) {
  if (Math.abs(a.length - b.length) > maxCost) return maxCost + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let rowMin = current[0];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + cost,
      );
      current[j] = value;
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > maxCost) return maxCost + 1;
    previous = current;
  }
  return previous[b.length];
}

function cleanCaptionText(text) {
  return text
    .replace(/[\s\r\n]+/g, "")
    .replace(/[，。！？；：、“”‘’《》（）()【】\[\]{}…,.!?;:"'`~\-—]/g, "")
    .replace(/200年/g, "200 年")
    .replace(/5点/g, "5 点")
    .replace(/4点/g, "4 点")
    .replace(/80小时/g, "80 小时")
    .trim();
}

const cues = parseSrt(fs.readFileSync(asrSrt, "utf8"));
const script = fs.readFileSync(scriptPath, "utf8").replace(/\uFEFF/g, "");
const indexed = buildIndex(script);

let cursor = 0;
const aligned = [];
const stats = { excellent: 0, good: 0, loose: 0 };

for (const cue of cues) {
  const target = normalizeText(cue.text);
  const targetLength = Math.max(1, target.length);
  const startMin = Math.max(0, cursor - 4);
  const startMax = Math.min(indexed.normalized.length - 1, cursor + 42);
  const minLen = Math.max(1, Math.floor(targetLength * 0.55));
  const maxLen = Math.max(minLen, Math.ceil(targetLength * 1.65) + 4);
  let best = null;

  for (let start = startMin; start <= startMax; start += 1) {
    const localGap = Math.max(0, start - cursor);
    const endMax = Math.min(indexed.normalized.length, start + maxLen);
    for (let end = start + minLen; end <= endMax; end += 1) {
      const candidate = indexed.normalized.slice(start, end);
      const hardLimit = Math.ceil(Math.max(targetLength, candidate.length) * 0.55) + 3;
      const distance = editDistance(target, candidate, hardLimit);
      const lengthPenalty = Math.abs(candidate.length - targetLength) * 0.08;
      const gapPenalty = localGap * 0.035;
      const score = distance + lengthPenalty + gapPenalty;
      if (!best || score < best.score) {
        best = { start, end, score, distance, candidateLength: candidate.length };
      }
    }
  }

  if (!best) {
    best = {
      start: cursor,
      end: Math.min(indexed.normalized.length, cursor + targetLength),
      score: 999,
      distance: 999,
      candidateLength: targetLength,
    };
  }

  const sourceStart = indexed.chars[best.start]?.sourceIndex ?? 0;
  const sourceEnd = indexed.chars[Math.max(best.start, best.end - 1)]?.sourceIndex ?? sourceStart;
  const text = cleanCaptionText(script.slice(sourceStart, sourceEnd + 1)) || cleanCaptionText(cue.text);
  const ratio = best.distance / Math.max(targetLength, best.candidateLength, 1);
  if (ratio <= 0.18) stats.excellent += 1;
  else if (ratio <= 0.36) stats.good += 1;
  else stats.loose += 1;

  aligned.push({ time: cue.time, text, ratio, asr: cue.text });
  cursor = Math.max(cursor, best.end);
}

const output = aligned.map((cue, index) => [
  String(index + 1),
  cue.time,
  cue.text,
].join("\n")).join("\n\n") + "\n";

fs.mkdirSync(path.dirname(path.resolve(outputSrt)), { recursive: true });
fs.writeFileSync(outputSrt, output, "utf8");

console.log(JSON.stringify({
  asrSrt: path.resolve(asrSrt),
  scriptPath: path.resolve(scriptPath),
  outputSrt: path.resolve(outputSrt),
  cues: aligned.length,
  ...stats,
  worst: aligned
    .map((cue, index) => ({ index: index + 1, ratio: Number(cue.ratio.toFixed(3)), text: cue.text, asr: cue.asr }))
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 8),
}, null, 2));
