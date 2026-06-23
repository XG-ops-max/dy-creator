# Open-source Boundary

Commit workflow code, reusable rules, generic configuration examples, and documentation.

Never commit:

- API keys, session cookies, tokens, or `.env` files.
- Film clips, source movies, generated videos, voice files, or ASR output.
- Commercial fonts, music, overlays, or other assets without a redistribution license.
- Personal absolute paths, user names, customer content, or local output folders.

Before each push, inspect staged files with `git status --short` and search for secrets and machine paths:

```powershell
git status --short
rg -n "(api[-_]?key|token|E:|C:\\Users|VOLCENGINE_API_KEY)" .
```
