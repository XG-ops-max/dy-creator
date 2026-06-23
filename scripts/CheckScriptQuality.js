const fs = require("fs");
const path = require("path");

const inputPath = process.argv[2];
const approve = process.argv.includes("--approve");
const outputArg = process.argv.find((arg, index) => index > 2 && !arg.startsWith("--"));

if (!inputPath) {
  throw new Error("Usage: node scripts/CheckScriptQuality.js <script.txt> [report.md] [--approve]");
}

const sourcePath = path.resolve(inputPath);
const root = process.cwd();
const reportPath = outputArg
  ? path.resolve(outputArg)
  : path.join(root, "dy-creator-state", "qc", "reports", `${path.basename(sourcePath, path.extname(sourcePath))}-report.md`);
const text = fs.readFileSync(sourcePath, "utf8").replace(/^\uFEFF/, "").trim();

const directRules = [
  ["炮市场", "泡市场", "常见同音误写"],
  ["长期注意", "长期主义", "常见同音误写"],
  ["卖稳健型理财", "买稳健型理财", "语义搭配疑似错误"],
  ["对海洛因呈引", "对海洛因成瘾", "常见同音误写"],
];

const findings = [];
for (const [needle, suggestion, reason] of directRules) {
  let offset = 0;
  while (true) {
    const found = text.indexOf(needle, offset);
    if (found === -1) break;
    findings.push({
      level: suggestion === "泡市场" || suggestion === "长期主义" ? "明确错误" : "疑似问题",
      original: needle,
      suggestion,
      reason,
    });
    offset = found + needle.length;
  }
}

const lines = text.split(/\r?\n/).map((line, index) => ({ number: index + 1, text: line.trim() })).filter((line) => line.text);
const formatting = [];
for (const line of lines) {
  if (line.text.length > 80 && !/[。！？!?；;：:]$/.test(line.text)) {
    formatting.push(`第 ${line.number} 行较长且没有句末标点，可能影响 TTS 停顿和字幕切分。`);
  }
}

for (const sentence of text.split(/[。！？!?\n]/).map((item) => item.trim()).filter(Boolean)) {
  const compact = sentence.replace(/[，、,\s]/g, "");
  if (compact.length > 58) {
    formatting.push(`超长语句（${compact.length} 字）：${sentence.slice(0, 42)}${sentence.length > 42 ? "..." : ""}`);
  }
}

const numbered = lines.map((line) => ({ ...line, match: line.text.match(/^(\d{1,2})[、.．]/) })).filter((line) => line.match);
const numbering = [];
for (let index = 1; index < numbered.length; index += 1) {
  const previous = Number(numbered[index - 1].match[1]);
  const current = Number(numbered[index].match[1]);
  if (current !== previous + 1) numbering.push(`列表编号从 ${previous} 跳到 ${current}（第 ${numbered[index].number} 行）。`);
}

const grouped = Object.groupBy(findings, ({ level }) => level);
const section = (title, items, render) => `## ${title}\n${items.length ? items.map(render).join("\n") : "- 无"}`;
const report = [
  "# 文案质检报告",
  "",
  `- 原稿：\`${sourcePath}\``,
  `- 状态：${approve ? "已确认，已生成 approved 文案" : "待人工确认，未修改原稿"}`,
  "",
  section("明确错误", grouped["明确错误"] || [], (item) => `- 原文：\`${item.original}\` → 建议：\`${item.suggestion}\`；原因：${item.reason}`),
  "",
  section("疑似问题", grouped["疑似问题"] || [], (item) => `- 原文：\`${item.original}\` → 建议：\`${item.suggestion}\`；原因：${item.reason}。请人工确认后修改。`),
  "",
  section("格式建议", formatting, (item) => `- ${item}`),
  "",
  section("编号检查", numbering, (item) => `- ${item}`),
  "",
  "## 通过项\n- 未自动修改任何原稿文字。\n- 字幕与配音仍以经确认的原稿为准。",
].join("\n");

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, report, "utf8");

let approvedPath = null;
if (approve) {
  approvedPath = path.join(root, "dy-creator-state", "qc", "approved", path.basename(sourcePath));
  fs.mkdirSync(path.dirname(approvedPath), { recursive: true });
  fs.copyFileSync(sourcePath, approvedPath);
}

console.log(JSON.stringify({ sourcePath, reportPath, approvedPath, findings: findings.length, formatting: formatting.length, numbering: numbering.length }, null, 2));
