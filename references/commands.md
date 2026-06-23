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
