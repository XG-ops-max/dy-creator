const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const apiKey = process.env.VOLCENGINE_API_KEY;
const voiceType = process.env.VOLCENGINE_VOICE_TYPE || process.env.VOLCENGINE_SPEAKER;
const cluster = process.env.VOLCENGINE_CLUSTER || "volcano_icl";
const speedRatio = Number(process.env.VOLCENGINE_SPEED_RATIO || 1.0);

const textPath = process.argv[2];
const outputPath = process.argv[3];

if (!apiKey) {
  console.error("Missing VOLCENGINE_API_KEY.");
  process.exit(1);
}

if (!voiceType) {
  console.error("Missing VOLCENGINE_VOICE_TYPE.");
  process.exit(1);
}

if (!textPath || !outputPath) {
  console.error("Usage: node scripts/TextToVoiceVolcengineV1.js <textPath> <outputMp3Path>");
  process.exit(1);
}

async function main() {
  const text = fs.readFileSync(textPath, "utf8").trim();
  if (!text) {
    throw new Error(`Text file is empty: ${textPath}`);
  }

  const response = await fetch("https://openspeech.bytedance.com/api/v1/tts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      app: { cluster },
      user: { uid: "ai-auto-edit" },
      audio: {
        voice_type: voiceType,
        encoding: "mp3",
        speed_ratio: speedRatio,
      },
      request: {
        reqid: crypto.randomUUID().replace(/-/g, ""),
        text,
        operation: "query",
      },
    }),
  });

  const bodyText = await response.text();
  let json;
  try {
    json = JSON.parse(bodyText);
  } catch {
    console.error(JSON.stringify({
      status: response.status,
      statusText: response.statusText,
      body: bodyText.slice(0, 1000),
    }, null, 2));
    process.exit(1);
  }

  if (!response.ok || json.code !== 3000 || !json.data) {
    console.error(JSON.stringify({
      status: response.status,
      statusText: response.statusText,
      code: json.code,
      message: json.message,
      body: bodyText.slice(0, 1000),
    }, null, 2));
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, Buffer.from(json.data, "base64"));

  console.log(JSON.stringify({
    status: response.status,
    code: json.code,
    message: json.message,
    cluster,
    voiceType,
    speedRatio,
    outputPath: path.resolve(outputPath),
    bytes: fs.statSync(outputPath).size,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
