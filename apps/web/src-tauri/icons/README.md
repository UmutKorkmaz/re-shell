# App icons

Generated, committed assets. `tauri.conf.json` references `32x32.png`,
`128x128.png`, `128x128@2x.png`, `icon.png`, `icon.icns` and `icon.ico`;
`64x64.png` is a spare desktop size produced by the same run.

They are derived from one 1024x1024 source, `../icon-source/icon.png`: the
signal-lime shell-prompt mark on the dashboard's dark canvas, drawn by
`../icon-source/generate_icon.py` (Pillow) from the dashboard's published color
tokens.

To regenerate (from `apps/web`):

```bash
python3 src-tauri/icon-source/generate_icon.py src-tauri/icon-source/icon.png
pnpm tauri icon src-tauri/icon-source/icon.png
# the desktop shell has no mobile targets:
rm -rf src-tauri/icons/ios src-tauri/icons/android src-tauri/icons/Square*Logo.png src-tauri/icons/StoreLogo.png
```
