# V2 Preset

- Canvas: 1920x1080, 30fps, MP4.
- B-roll: zoom 1.33 unless the user explicitly overrides it; darken to 70% opacity over black.
- Captions: centered at `960,540`, white, no outline, black shadow 5, fade in 0.5 seconds. Font file and its internal family name must be supplied by the project.
- Voice: Volcengine REST TTS, full-script generation, default speed 1.1, voice volume 2.0.
- BGM: volume 0.3, starts at the end of the first complete spoken sentence, fades in 0.5 seconds and out 0.9 seconds.
- Audio: build voice and BGM as a separate audio track without automatic mix normalization; validate continuity before remuxing into the video.
- Captions: first complete sentence is hidden; ASR supplies time, approved script supplies wording.

Do not hard-code a font, music path, voice ID, or local drive path into the preset. Put those in the project render config.
