# App icons (placeholder)

ENV-LIMITED: real binary icon assets are NOT committed in this scaffold.

`tauri.conf.json` references `icons/32x32.png`, `icons/128x128.png`,
`icons/128x128@2x.png`, `icons/icon.icns`, and `icons/icon.ico`. Generate them
from a single source image once the Tauri toolchain is available:

```bash
pnpm --filter re-shell-dashboard tauri icon path/to/source-1024.png
```

`tauri icon` writes all required sizes/formats into this directory. Until then,
`tauri build` will fail at the icon step — by design, since building is out of
scope for this env-limited scaffold (see docs/desktop.md).
