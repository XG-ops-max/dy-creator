# Project Contract

Create one project directory per video:

```text
project/
  script.txt
  assets/
    broll/
    fonts/
    music/
  audio/
  subtitles/
  output/
  dy-creator-state/
    qc/
    clip-usage-ledger.json
```

Use paths relative to the project wherever possible. The project owns its source media, fonts, music, outputs, QC reports, and reuse ledger. The skill directory contains only reusable scripts and workflow rules.

The user must provide or have rights to every B-roll clip, font, music track, and image asset used in a production.
