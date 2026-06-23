const fs = require("fs");
const path = require("path");

const inputSrt = process.argv[2];
const outputAss = process.argv[3];
const y = Number(process.argv[4] || 1056);
const fontSize = Number(process.argv[5] || 124);
const x = Number(process.argv[6] || 960);
const alignment = Number(process.argv[7] || 2);
const fontName = process.argv[8] || "DFPSongW12-GB";
const outline = Number(process.argv[9] || 6);
const shadow = Number(process.argv[10] || 0);
const fadeInMs = Number(process.argv[11] || 0);
const bold = Number(process.argv[12] ?? -1);

if (!inputSrt || !outputAss) {
  console.error("Usage: node scripts/SrtToFixedAss.js <input.srt> <output.ass> [anchorY] [fontSize] [anchorX] [alignment] [fontName] [outline] [shadow] [fadeInMs] [bold]");
  process.exit(1);
}

function assTime(srtTime) {
  const match = srtTime.match(/(\d+):(\d+):(\d+),(\d+)/);
  if (!match) throw new Error(`Invalid SRT time: ${srtTime}`);
  const [, hh, mm, ss, ms] = match;
  const cs = Math.floor(Number(ms) / 10);
  return `${Number(hh)}:${mm}:${ss}.${String(cs).padStart(2, "0")}`;
}

function escapeAss(text) {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/\r?\n/g, "\\N");
}

const raw = fs.readFileSync(inputSrt, "utf8").replace(/\uFEFF/g, "");
const blocks = raw.split(/\r?\n\r?\n/).map((block) => block.trim()).filter(Boolean);
const dialogues = [];

for (const block of blocks) {
  const lines = block.split(/\r?\n/);
  const timeLineIndex = lines.findIndex((line) => line.includes("-->"));
  if (timeLineIndex < 0) continue;
  const [startRaw, endRaw] = lines[timeLineIndex].split("-->").map((v) => v.trim());
  const text = lines.slice(timeLineIndex + 1).join("\n").trim();
  if (!text) continue;
  const fadeTag = fadeInMs > 0 ? `\\fad(${Math.round(fadeInMs)},0)` : "";
  dialogues.push(`Dialogue: 0,${assTime(startRaw)},${assTime(endRaw)},Fixed,,0,0,0,,{\\an${alignment}\\pos(${x},${y})${fadeTag}}${escapeAss(text)}`);
}

const ass = `[Script Info]
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Fixed,${fontName},${fontSize},&H00FFFFFF,&H000000FF,&H00000000,&H90000000,${bold},0,0,0,100,100,0,0,1,${outline},${shadow},${alignment},80,80,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${dialogues.join("\n")}
`;

fs.mkdirSync(path.dirname(path.resolve(outputAss)), { recursive: true });
fs.writeFileSync(outputAss, ass, "utf8");

console.log(JSON.stringify({
  inputSrt: path.resolve(inputSrt),
  outputAss: path.resolve(outputAss),
  cues: dialogues.length,
  x,
  y,
  fontSize,
  alignment,
  fontName,
  outline,
  shadow,
  fadeInMs,
  bold,
}, null, 2));
