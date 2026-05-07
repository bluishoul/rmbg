# RMBG - AI Image Background Removal Tool

A macOS desktop application for removing image backgrounds powered by [RMBG-2.0](https://huggingface.co/briaai/RMBG-2.0) CoreML model, built with Tauri and React.

## Features

- **Local CoreML inference** - runs entirely on-device via Apple CoreML (CPU + GPU), no cloud API needed
- **Batch processing** - select individual images or entire folders, process them concurrently
- **Fix & Erase regions** - draw boxes on the preview to fix missed areas or erase unwanted remnants
  - **Fix mode**: re-runs RMBG on the selected region and composites the result back
  - **Erase mode**: extracts the foreground in the selected region, then removes it from the matting
  - Supports move, resize, rotate on pending boxes; revert on completed boxes
- **Hold Space to peek** - hold the spacebar to temporarily toggle between original and matting preview
- **Real-time preview** - click any image to view full-screen with checkerboard transparency
- **Dark mode** - follows system appearance
- **Save all** - batch export all results to the Downloads folder
- **Gitee mirror fallback** - if HuggingFace model download fails (e.g. in China), automatically falls back to Gitee Release mirror

## Screenshots

| Batch | Local Model Support | API Support |
| :----: | :----: | :----: |
| ![Batch](./docs/screenshots/batch.png) | ![Local Model Support](./docs/screenshots/local-model.png) | ![API Support](./docs/screenshots/api.png) |

## Tech Stack

- [Tauri v2](https://v2.tauri.app/) - cross-platform desktop framework
- React + TypeScript - UI
- TailwindCSS - styling
- Headless UI + Heroicons - components & icons
- Swift sidecar + CoreML - on-device RMBG-2.0 inference
- [RMBG2Swift](https://github.com/VincentGourbin/RMBG2Swift) - CoreML model loader

## Requirements

- macOS 13+ (Ventura or later)
- Apple Silicon or Intel Mac with CoreML support
- Node.js 20+
- Rust
- Xcode Command Line Tools (for Swift sidecar build)

## Getting Started

```bash
git clone https://gitee.com/bluishoul/rmbg.git
cd rmbg
npm install
npm run tauri dev
```

To build a release:

```bash
npm run tauri build
```

The `.dmg` and `.app` will be generated in `src-tauri/target/release/bundle/`.

## License

### Project License
This project is licensed under the **MIT License** - see the LICENSE file for details.

### Model License ⚠️
The **RMBG-2.0 model** is licensed under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/deed.en) (Creative Commons Attribution-NonCommercial 4.0 International).

**This means:**
- ✅ **Allowed**: Personal use, academic research, non-commercial projects
- ❌ **Not Allowed**: Commercial use, selling as a service, using in commercial products

**For commercial applications**, please:
1. Contact [BRIA AI](https://www.bria.ai/) to inquire about commercial licensing
2. Or consider using alternative background removal models with permissive licenses (e.g., MIT, Apache 2.0)
