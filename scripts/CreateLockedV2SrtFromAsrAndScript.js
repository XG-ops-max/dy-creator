const fs = require("fs");
const path = require("path");

const asrSrt = process.argv[2];
const scriptPath = process.argv[3];
const outputSrt = process.argv[4];
const maxChars = Number(process.argv[5] || 22);

if (!asrSrt || !scriptPath || !outputSrt) {
  console.error("Usage: node scripts/CreateLockedV2SrtFromAsrAndScript.js <asr.srt> <script.txt> <output.srt> [maxChars=22]");
  process.exit(1);
}

const protectedWords = [
  "100万现金",
  "100万资产",
  "100万房贷",
  "100万",
  "1万块",
  "5万",
  "10万",
  "买的时候",
  "时候20万",
  "60到90",
  "90天",
  "3个月",
  "不叫你有100万",
  "不是100万资产",
  "处理问题",
  "唯一机会",
  "唯一出口",
  "第一次",
  "普通人",
  "泡市场",
  "义乌",
  "货代",
  "货源",
  "话术",
  "银行卡",
  "工资卡",
  "信用卡",
  "购物车",
  "消费主义",
  "低人一等",
  "打工机器",
  "选择权",
  "心理落差",
  "生活品质",
  "胜利者",
];

function parseTime(value) {
  const match = String(value).match(/(\d+):(\d{2}):(\d{2}),(\d{3})/);
  if (!match) throw new Error(`Invalid SRT time: ${value}`);
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4]) / 1000;
}

function srtTime(seconds) {
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = Math.floor(safe % 60);
  const millis = Math.round((safe - Math.floor(safe)) * 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
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
      const [startRaw, endRaw] = lines[timeIndex].split("-->").map((item) => item.trim());
      return {
        start: parseTime(startRaw),
        end: parseTime(endRaw),
        text: lines.slice(timeIndex + 1).join(""),
      };
    })
    .filter(Boolean);
}

function isCaptionChar(char) {
  return /[\u4e00-\u9fffA-Za-z0-9]/.test(char);
}

function captionText(text) {
  return Array.from(text.replace(/\uFEFF/g, "")).filter(isCaptionChar).join("");
}

function captionLength(text) {
  return captionText(text).length;
}

function splitScriptIntoSemanticUnits(script) {
  const units = [];
  let buffer = "";
  const boundaryPattern = /[。，、！？!?；;：:,.、\r\n]/;
  for (const char of script.replace(/\uFEFF/g, "").trim()) {
    buffer += char;
    if (boundaryPattern.test(char)) {
      const text = captionText(buffer);
      if (text) units.push(text);
      buffer = "";
    }
  }
  const tail = captionText(buffer);
  if (tail) units.push(tail);
  return units;
}

function firstMajorSentenceCaptionLength(script) {
  let buffer = "";
  for (const char of script.replace(/\uFEFF/g, "").trim()) {
    buffer += char;
    if (/[。！？!?\r\n]/.test(char)) return captionLength(buffer);
  }
  return captionLength(buffer);
}

function crossesProtectedWord(text, cut) {
  for (const word of protectedWords) {
    let start = text.indexOf(word);
    while (start >= 0) {
      const end = start + word.length;
      if (cut > start && cut < end) return true;
      start = text.indexOf(word, start + 1);
    }
  }
  return false;
}

function avoidProtectedCut(text, preferred, min, max) {
  if (!crossesProtectedWord(text, preferred)) return preferred;
  for (let cut = preferred + 1; cut <= Math.min(max, text.length - 1); cut += 1) {
    if (!crossesProtectedWord(text, cut)) return cut;
  }
  for (let cut = preferred - 1; cut >= min; cut -= 1) {
    if (!crossesProtectedWord(text, cut)) return cut;
  }
  return preferred;
}

function splitLongSemantic(text) {
  if (!text) return [];
  const forcedBoundaryWords = ["别做梦了"];
  for (const word of forcedBoundaryWords) {
    const index = text.indexOf(word);
    if (index >= 4 && index <= text.length - 2 && !crossesProtectedWord(text, index)) {
      return [text.slice(0, index), text.slice(index)];
    }
  }
  if (text.startsWith("所以你知道为什么") && text.includes("普通人")) {
    const index = text.indexOf("普通人");
    return [text.slice(0, index), text.slice(index)];
  }
  const softMaxChars = Math.min(maxChars, 18);
  if (text.length <= softMaxChars) return [text];

  const parts = [];
  let rest = text;
  const semanticBoundaryWords = ["可以", "能够", "才会", "就会", "就是", "不是", "不敢", "不能", "不会", "而是", "真正", "第一次", "普通人", "这个月", "买的时候"];
  const connectorWords = ["而不是", "但是", "但", "所以", "因为", "如果", "只要", "当你", "这才是"];
  const preferredChars = "的是了在把和而也就都你我他她它再能会要才后前时里上下一";
  while (rest.length > softMaxChars) {
    const min = Math.max(4, softMaxChars - 6);
    const max = Math.min(rest.length - 4, maxChars);
    const preferredMax = Math.min(max, softMaxChars);
    let cut = -1;

    const findWordBoundary = (words, upperBound) => {
      let best = -1;
      for (const word of words) {
        let index = rest.indexOf(word);
        while (index >= 0) {
          if (index >= min && index <= upperBound && !crossesProtectedWord(rest, index)) {
            best = Math.max(best, index);
          }
          index = rest.indexOf(word, index + 1);
        }
      }
      return best;
    };

    cut = findWordBoundary(connectorWords, preferredMax);
    if (cut < 0) cut = findWordBoundary(semanticBoundaryWords, preferredMax);
    if (cut < 0) cut = findWordBoundary(connectorWords, max);
    if (cut < 0) cut = findWordBoundary(semanticBoundaryWords, max);

    for (let index = max; index >= min; index -= 1) {
      if (cut > 0) break;
      if (crossesProtectedWord(rest, index)) continue;
      const prev = rest[index - 1];
      if (preferredChars.includes(prev)) {
        cut = index;
        break;
      }
    }
    if (cut < 0) cut = avoidProtectedCut(rest, softMaxChars, min, max);
    if (cut <= 0 || cut >= rest.length) break;
    parts.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest) parts.push(rest);
  return parts;
}

function buildAsrTimeline(cues) {
  const points = [];
  let total = 0;
  for (const cue of cues) {
    const length = Math.max(1, captionLength(cue.text));
    points.push({ startChars: total, endChars: total + length, start: cue.start, end: cue.end });
    total += length;
  }
  return { points, total };
}

function timeAtCharPosition(position, timeline) {
  if (!timeline.points.length) return 0;
  const target = Math.max(0, Math.min(timeline.total, position));
  for (const point of timeline.points) {
    if (target <= point.endChars) {
      const ratio = (target - point.startChars) / Math.max(1, point.endChars - point.startChars);
      return point.start + (point.end - point.start) * ratio;
    }
  }
  return timeline.points[timeline.points.length - 1].end;
}

const cues = parseSrt(fs.readFileSync(asrSrt, "utf8"));
const script = fs.readFileSync(scriptPath, "utf8");
const semanticUnits = splitScriptIntoSemanticUnits(script);
const timeline = buildAsrTimeline(cues);
const scriptTotal = semanticUnits.reduce((sum, text) => sum + text.length, 0);
const hiddenChars = firstMajorSentenceCaptionLength(script);
const scale = timeline.total / Math.max(1, scriptTotal);

let scriptCursor = 0;
let outputIndex = 1;
const output = [];
const debugRows = [];

for (let unitIndex = 0; unitIndex < semanticUnits.length; unitIndex += 1) {
  const unit = semanticUnits[unitIndex];
  const unitStart = scriptCursor;
  const unitEnd = scriptCursor + unit.length;
  scriptCursor = unitEnd;

  if (unitEnd <= hiddenChars) {
    debugRows.push({ unit: unitIndex + 1, hidden: true, text: unit });
    continue;
  }

  const unitStartTime = timeAtCharPosition(unitStart * scale, timeline);
  const unitEndTime = timeAtCharPosition(unitEnd * scale, timeline);
  const parts = splitLongSemantic(unit);
  const totalPartChars = parts.reduce((sum, item) => sum + Math.max(1, item.length), 0);
  let timeCursor = unitStartTime;

  for (let partIndex = 0; partIndex < parts.length; partIndex += 1) {
    const part = parts[partIndex];
    const partDuration = partIndex === parts.length - 1
      ? unitEndTime - timeCursor
      : (unitEndTime - unitStartTime) * (Math.max(1, part.length) / totalPartChars);
    const end = partIndex === parts.length - 1 ? unitEndTime : timeCursor + partDuration;
    if (end - timeCursor < 0.05) continue;
    output.push(String(outputIndex));
    output.push(`${srtTime(timeCursor)} --> ${srtTime(end)}`);
    output.push(part);
    output.push("");
    outputIndex += 1;
    timeCursor = end;
  }

  debugRows.push({ unit: unitIndex + 1, hidden: false, text: unit, parts });
}

fs.mkdirSync(path.dirname(path.resolve(outputSrt)), { recursive: true });
fs.writeFileSync(outputSrt, output.join("\n"), "utf8");

console.log(JSON.stringify({
  asrSrt: path.resolve(asrSrt),
  scriptPath: path.resolve(scriptPath),
  outputSrt: path.resolve(outputSrt),
  sourceCues: cues.length,
  semanticUnits: semanticUnits.length,
  outputCues: outputIndex - 1,
  scriptTotal,
  asrTotal: timeline.total,
  hiddenFirstMajorSentence: hiddenChars > 0,
  maxChars,
  firstVisible: debugRows.find((row) => !row.hidden)?.text || "",
  lastVisible: debugRows.filter((row) => !row.hidden).slice(-1)[0]?.text || "",
}, null, 2));
