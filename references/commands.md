# Commands

## B-roll preparation

```powershell
node scripts/SplitBrollByScene.js .\project\assets\source.mp4 .\project\assets\broll 0 0.35 2 12
node scripts/BuildClipManifest.js .\project\assets\broll .\project\assets\source.mp4 .\project\assets\broll\manifest.csv
```

Add tags to the manifest before selection. Check and register selected clips using a JSON config with a `clips` array:

```powershell
node scripts/CheckClipReuse.js .\project\render-config.json .\project\dy-creator-state\clip-usage-ledger.json
node scripts/PrepareBrollTimeline.js .\project\render-config.json
node scripts/RegisterClipUsage.js .\project\render-config.json my-video .\project\dy-creator-state\clip-usage-ledger.json
```

## V2 render config

```json
{
  "timelinePath": "./project/_compose/timeline-joined.mp4",
  "voicePath": "./project/audio/voice.mp3",
  "subtitlePath": "./project/subtitles/locked.ass",
  "bgmPath": "./project/assets/music/bgm.mp3",
  "fontsDir": "./project/assets/fonts",
  "outputPath": "./project/output/final.mp4",
  "bgmStartSec": 4.32,
  "voiceVolume": 2.0,
  "bgmVolume": 0.3,
  "videoOpacity": 0.7
}
```

Set `bgmStartSec` from the first complete sentence end on the aligned source timeline. It is intentionally not a fixed constant.

```powershell
node scripts/ComposeV2TwoStage.js .\project\v2-render-config.json
```

## Caption generation

Prefer word timestamps:

```powershell
python scripts/TranscribeAudioToWordJson.py .\project\audio\voice.mp3 .\project\subtitles\words.json
node scripts\CreateWordTimestampLockedV2Srt.js .\project\subtitles\words.json .\project\dy-creator-state\qc\approved\script.txt .\project\subtitles\locked.srt
node scripts\SrtToFixedAss.js .\project\subtitles\locked.srt .\project\subtitles\locked.ass 540 150 960 5 YourFontName 0 5 500 0
```

Fallback if only SRT timing exists:

```powershell
python scripts\TranscribeAudioToSrt.py .\project\audio\voice.mp3 .\project\subtitles\asr.srt
node scripts\CreateAsrBoundaryLockedV2Srt.js .\project\subtitles\asr.srt .\project\dy-creator-state\qc\approved\script.txt .\project\subtitles\locked.srt
```

## Cover generation

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\CreateRedShadowPosterV1.ps1 -Title "自由职业" -Subtitle "把自己当公司" -Badge "人生"
```

The cover script keeps the V1 text layout fixed and automatically chooses a semantic background category. Use `-BackgroundStyle` only when the automatic category is wrong.
