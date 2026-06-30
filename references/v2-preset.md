# V2 Preset

- Canvas: 1920x1080, 30fps, MP4.
- B-roll: zoom 1.33 unless the user explicitly overrides it; darken to 70% opacity over black.
- Captions: centered at `960,540`, white, no outline, black shadow 5, fade in 0.5 seconds. Font file and its internal family name must be supplied by the project.
- Voice: Volcengine REST TTS, full-script generation, default speed 1.1, voice volume 2.0.
- BGM: volume 0.3, starts at the end of the first complete spoken sentence, fades in 0.5 seconds and out 0.9 seconds.
- Audio: build voice and BGM as a separate audio track without automatic mix normalization; validate continuity before remuxing into the video.
- Captions: first complete sentence is hidden; ASR supplies time, approved script supplies wording.

Do not hard-code a font, music path, voice ID, or local drive path into the preset. Put those in the project render config.

## Caption Locking

Prefer word-timestamp locking:

1. Generate one complete TTS file from the approved script.
2. Transcribe the TTS into word timestamps with `TranscribeAudioToWordJson.py`.
3. Run `CreateWordTimestampLockedV2Srt.js` with the word JSON and approved script.
4. Render ASS with `SrtToFixedAss.js`.

The visible caption text must come from the approved script, not from ASR. ASR is only the timing source.

Protect numeric percentage tokens such as `5%`, `80%`, and `100%`. The `%` character must remain visible, and the number must not be split internally.

## B-roll Selection

- Select by concrete entity tags first, then semantic/emotion tags.
- Avoid a fixed source-film rotation. If several clips score similarly, use recent source order as a tie-breaker to avoid making adjacent videos feel identical.
- Enforce a two-video cooldown before reusing the same clip.
- Reject or replace clips with end credits, large embedded text, visible source subtitles, visible watermarks, unsafe/yellow imagery, or frozen frames.

## BGM Timing

`bgmStartSec` is not a fixed number. Compute it from the aligned timeline as the end timestamp of the first complete spoken sentence. The BGM should fade in after that point, not be repeatedly ducked or normalized against the voice.
