# Zhongyu English Hengshui Copybook Generator (Electron Edition)

[中文](README.md) | **English**

A desktop application that generates English copybooks in the Hengshui handwriting style. Enter English text, pick a line style and a generation mode, preview in real time, then print directly or export to PDF.

Current version: **2.0.3** (rewritten from PyQt6 to Electron since 2.0.0, see [UPGRADE.md](UPGRADE.md))

Copyright (c) 2026 Taizhou Jiangyan Zhongyu Information Technology Co., Ltd. · Website: https://www.tzzhy.cn/

## Features

- **Four generation modes**: Trace, Copy, Trace + Copy, Copybook
- **Two line styles**: Four-line Grid, Single Line
- **Real-time preview**: Canvas-rendered 800×1131 pages, PageUp/PageDown paging
- **Screen OCR** (new in 2.0.0): select any screen area and automatically fill the input box with the recognized text; supports English / Simplified Chinese / English + Chinese
- **Multiple tabs**: edit several projects at once, with a prompt when closing unsaved tabs
- **Custom header fields**: up to 3 (e.g. Class, Name, No.), with title and page-number support
- **Project files**: `.zyecb` format, bidirectionally compatible with the original PyQt6 v1.1.1, with file association registered (double-click to open)
- **Print & Print Preview** (new in 2.0.2): no need to export a PDF first — **Ctrl+P** opens the system print dialog directly; the preview window lets you check each page, zoom, and follow page numbers while scrolling
- **Automatic Chinese/English UI** (new in 2.0.3): follows the system language — Chinese UI on Chinese systems, English as the fallback for everything else; the `.zyecb` project file format is unaffected
- **PDF export**: multi-page A4 with high-resolution tracing/grid rendering; printing and exporting share the same A4 rendering pipeline for identical output
- **Layout engine fix**: fixed the original issue where single-line mode estimated lines as four-line grid, causing duplicated words across pages

## Tech Stack

- Electron 33 + electron-vite 2 + Vite 5 (plain JavaScript, no frontend framework)
- Canvas 2D layout rendering, tesseract.js offline OCR (bundled tessdata_fast language data)
- electron-builder cross-platform packaging (Windows NSIS, Linux AppImage/deb/rpm, macOS zip/dmg)

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

# Package installer for the current platform (output to dist/)
npm run dist

# Specific platform / architecture
npx electron-builder --linux AppImage deb rpm   # optional --x64 / --arm64
npx electron-builder --win nsis
npx electron-builder --mac zip
```

Requires Node.js 18 or later.

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
│           └── assets/    # Hengshui font, agreement texts
├── resources/             # Icons, copyright text, OCR language data (ocr-data)
└── out/                   # Build output
```

## License

[Apache-2.0](LICENSE)
