const fs = require("fs");
const path = require("path");

const asrSrt = process.argv[2];
const scriptPath = process.argv[3];
const outputSrt = process.argv[4];

if (!asrSrt || !scriptPath || !outputSrt) {
  console.error("Usage: node scripts/CreateAsrBoundaryLockedV2Srt.js <asr.srt> <script.txt> <output.srt>");
  process.exit(1);
}

function parseSrt(raw) {
  return raw.replace(/\uFEFF/g, "")
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split(/\r?\n/);
      const timeIndex = lines.findIndex((line) => line.includes("-->"));
      if (timeIndex < 0) return null;
      return {
        time: lines[timeIndex].trim(),
        text: lines.slice(timeIndex + 1).join(""),
      };
    })
    .filter(Boolean);
}

function isCaptionChar(char) {
  // Keep percent signs as protected caption text. ASR often says
  // "百分之八十" while the approved script writes "80%"; dropping "%"
  // can make the locked subtitle show only a partial number.
  return /[\u4e00-\u9fffA-Za-z0-9%％]/.test(char);
}

function captionChars(text) {
  return Array.from(String(text || "").replace(/\uFEFF/g, ""))
    .filter(isCaptionChar);
}

function firstMajorSentenceLength(script) {
  let buffer = "";
  for (const char of script.replace(/\uFEFF/g, "").trim()) {
    buffer += char;
    if (/[。！？?!\r\n]/.test(char)) return captionChars(buffer).length;
  }
  return captionChars(buffer).length;
}

function lcsPairs(asrChars, scriptChars) {
  const a = asrChars.map((char) => char.toLowerCase());
  const b = scriptChars.map((char) => char.toLowerCase());
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

function buildBoundaryMap(asrLength, scriptLength, pairs) {
  const boundaries = new Array(asrLength + 1);
  let pairIndex = 0;
  for (let boundary = 0; boundary <= asrLength; boundary += 1) {
    while (pairIndex < pairs.length && pairs[pairIndex][0] < boundary) pairIndex += 1;
    const prev = pairIndex > 0 ? pairs[pairIndex - 1] : null;
    const next = pairIndex < pairs.length ? pairs[pairIndex] : null;
    let value;
    if (prev && next && next[0] !== prev[0]) {
      const ratio = (boundary - prev[0]) / (next[0] - prev[0]);
      value = Math.round((prev[1] + 1) + ratio * (next[1] - prev[1] - 1));
    } else if (prev) {
      value = prev[1] + (boundary - prev[0]);
    } else if (next) {
      value = Math.max(0, next[1] - (next[0] - boundary));
    } else {
      value = Math.round(boundary * scriptLength / Math.max(1, asrLength));
    }
    boundaries[boundary] = Math.max(0, Math.min(scriptLength, value));
  }
  boundaries[0] = 0;
  boundaries[asrLength] = scriptLength;
  for (let index = 1; index < boundaries.length; index += 1) {
    if (boundaries[index] < boundaries[index - 1]) boundaries[index] = boundaries[index - 1];
  }
  return boundaries;
}

const cues = parseSrt(fs.readFileSync(asrSrt, "utf8"));
const script = fs.readFileSync(scriptPath, "utf8");
const scriptChars = captionChars(script);
const hiddenChars = firstMajorSentenceLength(script);

let asrCursor = 0;
const cueRanges = cues.map((cue) => {
  const length = captionChars(cue.text).length;
  const range = { start: asrCursor, end: asrCursor + length };
  asrCursor += length;
  return range;
});

const asrChars = cues.flatMap((cue) => captionChars(cue.text));
const pairs = lcsPairs(asrChars, scriptChars);
const boundaryMap = buildBoundaryMap(asrChars.length, scriptChars.length, pairs);

const output = [];
let outputIndex = 1;
let hiddenCues = 0;
let emptyCues = 0;

for (let cueIndex = 0; cueIndex < cues.length; cueIndex += 1) {
  const cue = cues[cueIndex];
  const range = cueRanges[cueIndex];
  let start = boundaryMap[range.start];
  let end = boundaryMap[range.end];
  if (cueIndex === cues.length - 1) end = scriptChars.length;
  if (end <= hiddenChars) {
    hiddenCues += 1;
    continue;
  }
  start = Math.max(start, hiddenChars);
  end = Math.max(start, end);
  const text = scriptChars.slice(start, end).join("");
  if (!text) {
    emptyCues += 1;
    continue;
  }
  output.push(String(outputIndex));
  output.push(cue.time);
  output.push(text);
  output.push("");
  outputIndex += 1;
}

fs.mkdirSync(path.dirname(path.resolve(outputSrt)), { recursive: true });
fs.writeFileSync(outputSrt, output.join("\n"), "utf8");

const srtText = output.filter((line, index) => index % 4 === 2).join("");
const scriptAfterHidden = scriptChars.slice(hiddenChars).join("");

console.log(JSON.stringify({
  asrSrt: path.resolve(asrSrt),
  scriptPath: path.resolve(scriptPath),
  outputSrt: path.resolve(outputSrt),
  sourceCues: cues.length,
  outputCues: outputIndex - 1,
  hiddenCues,
  emptyCues,
  hiddenFirstMajorSentence: hiddenChars > 0,
  asrChars: asrChars.length,
  scriptChars: scriptChars.length,
  matchedPairs: pairs.length,
  textMatchesScriptAfterHidden: srtText === scriptAfterHidden,
  scriptCharsAfterHidden: scriptAfterHidden.length,
  srtChars: srtText.length,
}, null, 2));
