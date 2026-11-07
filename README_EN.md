# Zhongyu English Hengshui Copybook Generator (Electron Edition)

[中文](README.md) | **English**

A desktop application that generates English copybooks in the Hengshui handwriting style. Enter English text, pick a line style and a generation mode, preview in real time, then print directly or export to PDF.

Current version: **2.0.7** (rewritten from PyQt6 to Electron since 2.0.0, see [UPGRADE.md](UPGRADE.md))

Copyright (c) 2026 Taizhou Jiangyan Zhongyu Information Technology Co., Ltd. · Website: https://www.tzzhy.cn/

## Features

- **Four generation modes**: Trace, Copy, Trace + Copy, Copybook
- **Two line styles**: Four-line Grid, Single Line
- **Two selectable fonts** (new in 2.0.6): Hengshui Fountain Pen and Hengshui Gel Pen, switched from the sidebar and saved with the project
- **Real-time preview**: Canvas-rendered 800×1131 pages, PageUp/PageDown paging
- **Screen OCR** (new in 2.0.0): select any screen area and automatically fill the input box with the recognized text; supports English / Simplified Chinese / English + Chinese
- **Multiple tabs**: edit several projects at once, with a prompt when closing unsaved tabs
- **Custom header fields**: up to 3 (e.g. Class, Name, No.), with title and page-number support
- **Project files**: `.zyecb` format, bidirectionally compatible with the original PyQt6 v1.1.1, with file association registered (double-click to open)
- **Print & Print Preview** (new in 2.0.2): no need to export a PDF first — **Ctrl+P** opens the system print dialog directly; the preview window lets you check each page, zoom, and follow page numbers while scrolling
- **Automatic Chinese/English UI** (new in 2.0.3): follows the system language — Chinese UI on Chinese systems, English as the fallback for everything else; the `.zyecb` project file format is unaffected
- **Automatic update checks** (new in 2.0.7): silently checks for updates 5 seconds after launch, and can be triggered manually from **Help → Check for Updates**; Simplified Chinese systems download from GitCode, English and other languages download from GitHub, with automatic fallback to the other source
- **Custom grid and tracing colors** (new in 2.0.5): pick the grid-line color and the tracing text color with a color picker; both are saved with the project
- **PDF export**: multi-page A4 with high-resolution tracing/grid rendering; printing and exporting share the same A4 rendering pipeline for identical output
- **Layout engine fix**: fixed the original issue where single-line mode estimated lines as four-line grid, causing duplicated words across pages

## Tech Stack

- Electron 41 + electron-vite 3 + Vite 6 (plain JavaScript, no frontend framework)
- electron-updater auto-update (GitHub / GitCode dual source)
- Canvas 2D layout rendering, tesseract.js offline OCR (bundled tessdata_fast language data)
- electron-builder cross-platform packaging (Windows NSIS, Linux AppImage/deb/rpm, macOS zip/dmg)

## Font

- Two self-made typefaces (both 1.1.0) are bundled: **Hengshui Fountain Pen** and **Hengshui Gel Pen** (`woff2` with `woff` fallback), switchable from the **Font** dropdown in the sidebar, distributed with the app under the MIT License — see [`src/renderer/src/assets/fonts/LICENSE.txt`](src/renderer/src/assets/fonts/LICENSE.txt)
- Font project home pages (standalone downloads): GitHub <https://github.com/pollybird/Hengshui_Fonts> | GitCode <https://gitcode.com/pollybird/Hengshui_Fonts> | Gitee <https://gitee.com/pollybird/hengshui-fonts>
- It covers printable ASCII (U+0020–U+007E) and Western supplement symbols; Chinese characters such as the page-number labels fall back to a system font

## Development

```bash
# Install dependencies (a registry mirror is recommended in mainland China)
npm install --registry=https://registry.npmmirror.com
# If the Electron binary download is slow:
# export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/

# Development mode
npm run dev

# Build
npm run build

# Unit tests / lint / format check
npm test
npm run lint
npm run format:check

# Package installer for the current platform (output to dist/)
npm run dist

# Specific platform / architecture
npx electron-builder --linux AppImage deb rpm   # optional --x64 / --arm64
npx electron-builder --win nsis
npx electron-builder --mac zip
```

Requires Node.js 20 or later (22 LTS recommended).

## Auto-update & Releases

### Update sources

- **Simplified Chinese systems**: prefer GitCode (faster access in mainland China), fall back to GitHub on failure
- **English and other languages**: prefer GitHub, fall back to GitCode on failure
- Checks silently 5 seconds after launch; can also be triggered from **Help → Check for Updates**
- A new version is confirmed before downloading; you can choose **Later**, **Skip This Version**, or **Download and Install**, then restart immediately once downloaded

Platform limitations:

- **Windows (x64)** and **Linux x64** support auto-update (on Windows arm64, use the x64 installer — Windows runs it via emulation)
- **macOS** builds are unsigned and cannot pass the auto-install signature check; the app will ask you to download manually from the release page
- **Linux arm64** has no separate update manifest (electron-updater does not recognize `latest-linux-arm64.yml`); download manually

### Release process

1. Bump `version` in `package.json`, commit and push
2. Create a tag matching the version (e.g. `2.0.7`, **without** a `v` prefix) and push it:

   ```bash
   git tag 2.0.7
   git push origin 2.0.7
   ```

3. GitHub Actions ([`.github/workflows/release.yml`](.github/workflows/release.yml)) builds on all three platforms:
   - Linux: AppImage / deb / rpm (x64 + arm64)
   - Windows: NSIS installer (x64)
   - macOS: zip (x64 + arm64)
4. Artifacts are uploaded to the GitHub Release
5. Mirroring to GitCode is best done locally (cross-border uploads of large installers from GitHub runners are heavily throttled and can time out):

   ```bash
   # Download all GitHub Release assets to a local directory first, then
   GITCODE_TOKEN=<token> DIST_DIR=<assets-dir> npm run publish:gitcode
   ```

   You can also run the `Release` workflow manually, provide the tag, and check `gitcode` to let CI attempt the upload.

GitCode sync uses `GITCODE_TOKEN` (a GitCode access token); to let the workflow upload, add the same secret in the repository settings.

Auto-update requires the filenames in `latest.yml` / `latest-linux.yml` to match the uploaded installers exactly, so the `electron-builder` `artifactName` uses ASCII names — do not change them casually.

## Usage

1. Enter the English text for the copybook in the **Input Content** box on the left, or click **Screen OCR** to capture text from the screen automatically
2. Adjust font size, letter spacing, and position offsets
3. Choose a line style (Four-line Grid / Single Line) and a generation mode (Trace / Copy / Trace + Copy / Copybook)
4. Optionally add custom header fields (Class, Name, etc.)
5. Save / load `.zyecb` project files
6. Click **Export PDF** to generate the copybook file, or use **File menu → Print / Print Preview** to print directly

### Print & Print Preview

- **File → Print (Ctrl+P)**: renders all pages of the current project, then opens the system print dialog — pick a printer and print directly
- **File → Print Preview**: opens a standalone preview window to check each page, with zoom (fit width / 40%~200%) and page numbers that follow scrolling; you can also click **Print** right in that window
- Printing and PDF export share the same A4 rendering pipeline (192 DPI), so the output is identical

### Screen OCR

- Click the **Screen OCR** button below the input box and choose the recognition language (English / Simplified Chinese / English + Chinese)
- Once the screen is frozen, drag to select the text area to recognize
- **Enter** or double-click to confirm, **Esc** to cancel; the recognized text is filled into the input box automatically
- OCR language data is bundled — no network required

### Shortcuts

| Shortcut | Action |
|---|---|
| Ctrl+N | New project |
| Ctrl+O | Open project |
| Ctrl+S | Save project |
| Ctrl+Shift+S | Save As |
| Ctrl+P | Print |
| Ctrl+F | Export PDF |
| PageUp / PageDown | Preview paging |
| Alt+F / Alt+E / Alt+H | Open File / Edit / Help menu |

## Directory Structure

```
├── src/
│   ├── main/              # Main process (windows, menus, IPC, OCR, print & PDF export)
│   ├── preload/           # Preload scripts (contextIsolation safe bridge)
│   └── renderer/          # Renderer process (index.html main UI, print.html print rendering, preview.html print preview, sel.html screen selection)
│       └── src/
│           ├── engine/    # copybook.js layout engine, zyecb-format.js project file I/O
│           └── assets/    # Self-made Hengshui Fountain Pen and Gel Pen fonts (woff2/woff), agreement texts
├── resources/             # Icons, copyright text, OCR language data (ocr-data)
├── scripts/               # Release scripts (publish-gitcode.mjs)
├── tests/                 # Unit tests (Node built-in test runner)
├── .github/workflows/     # GitHub Actions: CI and tag-triggered multi-platform release
└── out/                   # Build output
```

## License

[Apache-2.0](LICENSE)
