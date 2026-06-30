const fs = require("fs");
const path = require("path");

const sourcePath = process.argv[2];
const reportPath = process.argv[3];
const lexiconPath = process.argv[4]
  || path.join(process.cwd(), "dy-creator", "script-qc", "pronunciation-lexicon.json");

if (!sourcePath || !reportPath) {
  throw new Error("Usage: node scripts/CheckPolyphonicWords.js <script.txt> <report.md> [lexicon.json]");
}

const text = fs.readFileSync(sourcePath, "utf8").replace(/^\uFEFF/, "");
const lexicon = JSON.parse(fs.readFileSync(lexiconPath, "utf8"));
const matches = [];

for (const entry of lexicon.entries || []) {
  let from = 0;
  while (true) {
    const index = text.indexOf(entry.phrase, from);
    if (index < 0) break;
    matches.push({ ...entry, offset: index });
    from = index + entry.phrase.length;
  }
}

const lines = [
  "# 多音字核对报告",
  "",
  `- 原稿：\`${path.resolve(sourcePath)}\``,
  `- 词典：\`${path.resolve(lexiconPath)}\``,
  "",
  "## 待确认读音",
];

if (matches.length === 0) {
  lines.push("- 未命中当前多音字词典。");
} else {
  for (const item of matches) {
    lines.push(`- \`${item.phrase}\`：\`${item.character}\` 应读 \`${item.pinyin}\`（${item.display}）。${item.note}`);
  }
}

lines.push("", "## 配音规则", "- 字幕始终保留原文。", "- TTS 前必须确认以上读音。", "- 词典命中不自动改写汉字；强制纠音必须使用已验证的 TTS 注音方式或短句重配。");

fs.mkdirSync(path.dirname(path.resolve(reportPath)), { recursive: true });
fs.writeFileSync(reportPath, lines.join("\n"), "utf8");
console.log(JSON.stringify({
  sourcePath: path.resolve(sourcePath),
  reportPath: path.resolve(reportPath),
  lexiconPath: path.resolve(lexiconPath),
  matches,
}, null, 2));
