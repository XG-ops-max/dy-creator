# Cover V1

Use `scripts/CreateRedShadowPosterV1.ps1` for the fixed red-shadow cover preset.

## Fixed Text Layer

- Generate two outputs by default: `4x3` and `3x4`.
- Save under the project `outputs/covers` directory.
- Use the naming pattern `{title}_{ratio}_v1_{YYYYMMDD}.png`.
- Keep the main title red with a black shadow.
- Keep the subtitle white with a black shadow.
- Keep the top-left red badge and its text fixed unless the user asks to edit the preset.
- Draw all Chinese text locally with the bundled/local font path. Do not ask an image model to render Chinese title text.

## Background Layer

The background must match the theme while staying secondary to the text.

- Use `-BackgroundStyle auto` by default.
- Use a stable background variant derived from the theme so the same theme is reproducible.
- Do not reuse one generic background for every cover.
- Do not generate visible Chinese or English text in the background.
- Keep the background dark, cinematic, and readable behind the title.

Current categories:

- `market`: first order, small business, transaction, marketplace.
- `freelance`: no office job, side business, clients, personal company.
- `housing`: buying a house, mortgage, house debt.
- `trap`: acquaintances, dinner-table setups, cooperation traps.
- `game`: games, self-control, parents, screening.
- `work-system`: discipline, clock-in, factory, work system.

When a theme does not match a category, add a new category if it becomes common. Otherwise let the script warn and use the default background.

## Command

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\CreateRedShadowPosterV1.ps1 -Title "自由职业" -Subtitle "把自己当公司" -Badge "人生"
```

Force a category only when needed:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\CreateRedShadowPosterV1.ps1 -Title "自由职业" -Subtitle "把自己当公司" -Badge "人生" -BackgroundStyle freelance
```
