# DY Creator

An open-source Codex Skill for producing Chinese narration-led short videos from an approved script and user-owned B-roll.

## What It Does

- Quality-checks a script before TTS and preserves an approved version.
- Generates Volcengine TTS from environment-based credentials.
- Uses ASR for caption timing while keeping final caption text faithful to the approved script.
- Splits, catalogs, and reuses owned B-roll with a cooldown ledger.
- Renders the V2 layout: centered captions, darkened visuals, and BGM that starts after the first complete spoken sentence.
- Mixes voice and BGM separately before remuxing to avoid intermittent background music.

## Install

Clone this repository, then place the `dy-creator` directory in your Codex skills directory:

```powershell
git clone https://github.com/XG-ops-max/dy-creator.git
Copy-Item -Recurse .\dy-creator "$HOME\.codex\skills\dy-creator"
```

Restart or refresh Codex after installation.

## Requirements

- Node.js 20+
- FFmpeg and FFprobe on `PATH`
- Python with `faster-whisper` for ASR
- A Volcengine TTS API key and voice ID stored locally in environment variables

Copy `.env.example` to a local `.env` file and fill it privately. Never commit that file.

## Usage

Invoke the Skill in Codex with a request such as:

```text
Use $dy-creator to turn my approved Chinese script into a narrated short video.
```

Read [SKILL.md](SKILL.md) for the workflow and [references/commands.md](references/commands.md) for commands.

## Privacy and Rights

This repository intentionally excludes API keys, source films, B-roll clips, generated videos, fonts, music, and other licensed assets. You are responsible for having the rights to every asset used in your own production.

## License

MIT. See [LICENSE](LICENSE).
