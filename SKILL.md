---
name: dy-creator
description: Create Chinese narration-led short videos from a supplied script, a user-owned B-roll library, and optional music. Use when Codex needs to quality-check a script, synthesize Volcengine TTS, align original-script subtitles to ASR timing, prepare scene-split B-roll, prevent clip reuse, render a V2 centered-caption video, or make a localized video revision.
---

# DY Creator

Create a project-local video workflow. Never commit API keys, private source footage, generated media, fonts, music, output files, or absolute machine paths.

## Install

Clone this repository, then place the `dy-creator` directory under `~/.codex/skills/` (or another configured Codex skill directory). Restart or refresh Codex so it discovers the skill.

## Prerequisites

Require `ffmpeg` and `ffprobe` on PATH. Use Node.js 20+ for TTS. Install Python dependencies for ASR:

```powershell
pip install faster-whisper
```

Set secrets in a local `.env` or shell environment. Do not write them into scripts or config files.

```text
VOLCENGINE_API_KEY
VOLCENGINE_VOICE_TYPE
VOLCENGINE_CLUSTER=volcano_icl
VOLCENGINE_SPEED_RATIO=1.1
```

Read [references/project-contract.md](references/project-contract.md) before creating or editing a project. Read [references/v2-preset.md](references/v2-preset.md) before a V2 render.

## Workflow

1. Ask for the estimated duration before beginning a user task. For a change to an existing video, ask whether it is a localized revision or a permanent workflow change unless the user already specified it.
2. Save the supplied script as UTF-8 text with its punctuation intact. Run `PrepareApprovedScript.js`; stop before TTS until the user approves the quality report.
3. Produce one full TTS voice track with `TextToVoiceVolcengineV1.js`. Use the approved script only.
4. Run ASR with `TranscribeAudioToSrt.py`. Treat ASR as a timing source only.
5. Run `CreateLockedV2SrtFromAsrAndScript.js` to lock final caption wording to the approved script, then run `SrtToFixedAss.js` to render ASS.
6. Prepare owned B-roll with `SplitBrollByScene.js` and `BuildClipManifest.js`. Select clips from semantic and entity tags, then check reuse before rendering.
7. Normalize and concatenate the selected B-roll with `PrepareBrollTimeline.js`.
8. Render using `ComposeV2TwoStage.js`. Set `bgmStartSec` to the end timestamp of the first complete spoken sentence. This script renders video once, mixes audio separately without normalization, then remuxes the verified audio.
9. Sample the opening, middle, ending, and every user-flagged point. Check caption timing/text, frozen frames, source subtitles, watermarks, unsafe imagery, font fallback, and BGM continuity.
10. Register the selected clips only after the final output passes review.

## Required Rules

- Preserve the user’s script punctuation because it controls TTS pauses and semantic subtitle boundaries.
- Use original-script text for visible captions; never publish ASR’s literal wording.
- Hide the first complete sentence’s caption in V2, but keep its timing so the BGM starts when that sentence ends.
- Do not split protected words or meaningful phrases mechanically. Prefer punctuation, line breaks, then semantic connectors.
- Use multiple source films. Favor concrete entity tags before abstract emotion tags.
- Reject or replace clips with unsafe imagery, visible end credits, large embedded text, source subtitles, or watermarks. Do not assume cropping can solve every case.
- Enforce a two-video cooldown before reusing a clip.
- Keep all output and state under the project directory, never beside the skill.

## Render Modes

**Localized revision**: Change only the requested clip, subtitle text, timing, mix level, or cover in the current project. Do not alter global presets.

**Permanent workflow change**: Update the project preset/reference and report exactly what changed. Do not silently modify typography, caption position, audio levels, or B-roll policy.

## Script Commands

```powershell
# Report, then approve the exact script version.
node scripts/PrepareApprovedScript.js .\project\script.txt .\project
node scripts/PrepareApprovedScript.js .\project\script.txt .\project --approve

# TTS, ASR, script-locked captions, and ASS.
node scripts/TextToVoiceVolcengineV1.js .\project\dy-creator-state\qc\approved\script.txt .\project\audio\voice.mp3
python scripts/TranscribeAudioToSrt.py .\project\audio\voice.mp3 .\project\subtitles\asr.srt
node scripts/CreateLockedV2SrtFromAsrAndScript.js .\project\subtitles\asr.srt .\project\dy-creator-state\qc\approved\script.txt .\project\subtitles\locked.srt
node scripts/SrtToFixedAss.js .\project\subtitles\locked.srt .\project\subtitles\locked.ass 540 150 960 5 YourFontName 0 5 500 0
```

Read [references/commands.md](references/commands.md) for B-roll and render commands. Read [references/open-source-boundary.md](references/open-source-boundary.md) before committing or publishing.
