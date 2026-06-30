const fs = require("fs");
const path = require("path");

const wordJsonPath = process.argv[2];
const scriptPath = process.argv[3];
const outputSrt = process.argv[4];
const maxChars = Number(process.argv[5] || 18);

if (!wordJsonPath || !scriptPath || !outputSrt) {
  console.error("Usage: node scripts/CreateWordTimestampLockedV2Srt.js <words.json> <script.txt> <output.srt> [maxChars=18]");
  process.exit(1);
}

function isCaptionChar(char) {
  // Keep percent signs as protected caption text. ASR often says
  // "百分之八十" while the approved script writes "80%"; dropping "%"
  // can make the locked subtitle show only a partial number.
  return /[\u4e00-\u9fffA-Za-z0-9%％]/.test(char);
}

function srtTime(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = Math.floor(safe % 60);
  const millis = Math.round((safe - Math.floor(safe)) * 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}

function scriptCaptionItems(script) {
  const items = [];
  for (let sourceIndex = 0; sourceIndex < script.length; sourceIndex += 1) {
    const char = script[sourceIndex];
    if (isCaptionChar(char)) {
      let next = sourceIndex + 1;
      let boundary = "";
      while (next < script.length && !isCaptionChar(script[next])) {
        boundary += script[next];
        next += 1;
      }
      items.push({
        char,
        normalized: char.toLowerCase(),
        sourceIndex,
        boundary,
      });
    }
  }
  return items;
}

function asrCharItems(words) {
  const items = [];
  for (const word of words) {
    const chars = Array.from(String(word.word || "")).filter(isCaptionChar);
    if (!chars.length) continue;
    const start = Number(word.start);
    const end = Math.max(start + 0.01, Number(word.end));
    const span = end - start;
    for (let index = 0; index < chars.length; index += 1) {
      items.push({
        char: chars[index],
        normalized: chars[index].toLowerCase(),
        start: start + span * index / chars.length,
        end: start + span * (index + 1) / chars.length,
      });
    }
  }
  return items;
}

function isNumericUnitChar(char) {
  return /[0-9.%％]/.test(char || "");
}

function lcsPairs(aItems, bItems) {
  const a = aItems.map((item) => item.normalized);
  const b = bItems.map((item) => item.normalized);
  const cols = b.length + 1;
  const table = new Uint16Array((a.length + 1) * cols);
  for (let i = a.length - 1; i >= 0; i -= 1) {
    const row = i * cols;
    const nextRow = (i + 1) * cols;
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[row + j] = a[i] === b[j]
        ? table[nextRow + j + 1] + 1
        : Math.max(table[nextRow + j], table[row + j + 1]);
    }
  }
  const pairs = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      pairs.push([i, j]);
      i += 1;
      j += 1;
    } else if (table[(i + 1) * cols + j] >= table[i * cols + j + 1]) {
      i += 1;
    } else {
      j += 1;
    }
  }
  return pairs;
}

function firstMajorSentenceLength(scriptItems) {
  for (let index = 0; index < scriptItems.length; index += 1) {
    if (/[。！？?!\r\n]/.test(scriptItems[index].boundary)) return index + 1;
  }
  return scriptItems.length;
}

function interpolateTimes(scriptItems, asrItems, pairs) {
  const times = new Array(scriptItems.length).fill(null);
  for (const [asrIndex, scriptIndex] of pairs) {
    const asr = asrItems[asrIndex];
    times[scriptIndex] = { start: asr.start, end: asr.end };
  }

  let firstKnown = times.findIndex(Boolean);
  if (firstKnown < 0) throw new Error("No aligned word timestamps.");
  for (let i = firstKnown - 1; i >= 0; i -= 1) {
    const next = times[i + 1];
    times[i] = { start: Math.max(0, next.start - 0.12), end: next.start };
  }
  for (let i = firstKnown + 1; i < times.length; i += 1) {
    if (times[i]) continue;
    let nextKnown = i + 1;
    while (nextKnown < times.length && !times[nextKnown]) nextKnown += 1;
    const prev = times[i - 1];
    if (nextKnown < times.length) {
      const next = times[nextKnown];
      const missing = nextKnown - i + 1;
      const step = Math.max(0.03, (next.start - prev.end) / missing);
      times[i] = { start: prev.end + step * 0.2, end: prev.end + step };
    } else {
      times[i] = { start: prev.end, end: prev.end + 0.12 };
    }
  }
  for (let i = 1; i < times.length; i += 1) {
    if (times[i].start < times[i - 1].end) times[i].start = times[i - 1].end;
    if (times[i].end < times[i].start + 0.01) times[i].end = times[i].start + 0.01;
  }
  return times;
}

function shouldCut(items, times, index, currentStart, hiddenEnd) {
  if (index < hiddenEnd) return false;
  const currentLength = index - currentStart + 1;
  const boundary = items[index].boundary || "";
  const nextGap = index + 1 < times.length ? times[index + 1].start - times[index].end : 999;
  const currentChar = items[index].char;
  const nextChar = index + 1 < items.length ? items[index + 1].char : "";
  if (isNumericUnitChar(currentChar) && isNumericUnitChar(nextChar)) return false;
  if (/[。！？?!\r\n]/.test(boundary)) return true;
  if (/[，,：:；;]/.test(boundary) && (nextGap >= 0.12 || currentLength >= 8)) return true;
  if (nextGap >= 0.24 && currentLength >= 4) return true;
  if (currentLength >= maxChars) return true;
  return false;
}

const wordJson = JSON.parse(fs.readFileSync(wordJsonPath, "utf8"));
const script = fs.readFileSync(scriptPath, "utf8");
const scriptItems = scriptCaptionItems(script);
const asrItems = asrCharItems(wordJson.words || []);
const pairs = lcsPairs(asrItems, scriptItems);
const times = interpolateTimes(scriptItems, asrItems, pairs);
const hiddenEnd = firstMajorSentenceLength(scriptItems);

const cues = [];
let start = hiddenEnd;
for (let index = hiddenEnd; index < scriptItems.length; index += 1) {
  if (!shouldCut(scriptItems, times, index, start, hiddenEnd) && index < scriptItems.length - 1) continue;
  const text = scriptItems.slice(start, index + 1).map((item) => item.char).join("");
  const cueStart = times[start].start;
  let cueEnd = times[index].end;
  if (index + 1 < times.length) cueEnd = Math.min(cueEnd + 0.04, times[index + 1].start - 0.01);
  if (cueEnd - cueStart >= 0.08 && text) cues.push({ start: cueStart, end: cueEnd, text });
  start = index + 1;
}

const output = [];
for (let index = 0; index < cues.length; index += 1) {
  output.push(String(index + 1));
  output.push(`${srtTime(cues[index].start)} --> ${srtTime(cues[index].end)}`);
  output.push(cues[index].text);
  output.push("");
}

fs.mkdirSync(path.dirname(path.resolve(outputSrt)), { recursive: true });
fs.writeFileSync(outputSrt, output.join("\n"), "utf8");

const text = cues.map((cue) => cue.text).join("");
const expected = scriptItems.slice(hiddenEnd).map((item) => item.char).join("");
console.log(JSON.stringify({
  wordJsonPath: path.resolve(wordJsonPath),
  scriptPath: path.resolve(scriptPath),
  outputSrt: path.resolve(outputSrt),
  asrChars: asrItems.length,
  scriptChars: scriptItems.length,
  matchedPairs: pairs.length,
  hiddenChars: hiddenEnd,
  cues: cues.length,
  textMatchesScriptAfterHidden: text === expected,
  firstCue: cues[0],
  lastCue: cues[cues.length - 1],
}, null, 2));
