# Axiomatic

Solarized-themed PDF reader for math textbooks. Vim navigation, LaTeX notes, spaced-repetition snip review, pomodoro timer. Desktop (Linux) + Android.

Built with Tauri 2 + React 19 + TypeScript + Rust.

## Features

### Reading
- PDF rendering via PDFium (native C library, JPEG output)
- Text search with match highlighting and navigation
- Zoom (25%--500%) with two-tier imperative system (instant CSS + debounced re-render)
- Automatic progress tracking (page/total, last read timestamp)
- PDF outline/TOC sidebar with collapsible sections
- Highlights and bookmarks with color coding
- PDF clipping (extract page ranges)

### Notes
- Per-page split-pane Markdown editor with full vim keybindings (CodeMirror 6)
- LaTeX math rendering inline (`$E=mc^2$`) and display blocks (`$$\sum x^2$$`)
- Image paste from clipboard, stored in SQLite
- Notes accessible from reader, carousel, and snip table

### Snip system
- Drag-to-select crosshair overlay captures PDF regions as snips
- Loop carousel for spaced-repetition review (sorted/shuffled modes)
- Snip status tracking: open / solid / attention
- Cross-book snip browsing with AND/OR tag filtering (batch tags OR-ed)
- Multi-column sortable table (label, source, page, status, created)
- Inline rename, bulk tag/status operations via context menu
- Filter state persists across app restarts

### Book management
- Library grid with starred section + per-directory sections
- Book status: open / in-progress / need-revisit / done
- Per-directory progress bars (books done, snips solidified)
- Tag system for book categorization
- Slug migration dialog for renamed PDFs (bigram similarity matching)
- Manual library refresh button

### Study tools
- Pomodoro timer with configurable presets (45/10, 60/10, 90/15)
- Break overlay notifications with long break support
- XP tracking per book and per directory
- Study statistics dashboard

### Navigation & UX
- Command palette (`Ctrl+P`) with fuzzy search
- Vim keybindings everywhere: `j/k` scroll, `h/j/k/l` grid, full vim in editor
- Tab management: close left/right, `Ctrl+PageUp/Down`, reopen closed tabs
- Zen mode (hide all chrome, notes still openable)
- Solarized light & dark themes with OS detection
- Keyboard-navigable context menus (arrow keys, j/k, Enter)

### Mobile (Android)
- Touch gestures: swipe navigation, pinch-to-zoom
- Adaptive render config (lower DPR, concurrency on mobile)
- Native directory picker via Kotlin plugin
- 44px minimum touch targets

## Install

### Desktop (Linux)
Download `.deb`, `.rpm`, or `.AppImage` from [Releases](../../releases).

### Android
Download `Axiomatic_vX.Y.Z_aarch64.apk` from [Releases](../../releases).

## Build from source

Requires Node.js 20+, Rust 1.77+, and [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/).

```sh
npm ci
npm run build          # desktop (Linux)
npm run tauri android build --apk true   # Android APK
```

The bundled app will be in `src-tauri/target/release/bundle/`.

PDFium shared library (`libpdfium.so`) must be in `src-tauri/resources/`. Download from [pdfium-binaries](https://github.com/bblanchon/pdfium-binaries).

## Development

```sh
npm run dev            # tauri dev (vite + rust)
npm run vite:dev       # vite only (no tauri)
npm run test           # 502 vitest tests
cargo test --lib       # 91 rust tests (from src-tauri/)
```

## Architecture

```
React (Vite + SWC)  <──IPC──>  Tauri/Rust  <───>  SQLite
                    <──pdfium://>  PDFium   <───>  .axiomatic/ (JSON state)
```

Three-tier storage:
- **SQLite** -- structured relational data (notes, highlights)
- **`.axiomatic/`** -- portable per-library JSON (progress, snips, starred, XP, book status, sessions)
- **localStorage** -- ephemeral UI state (theme, tabs, filters)

## Roadmap

- [ ] Tab drag-and-drop reorder
- [ ] Display tags in mixed-course carousel snips
- [ ] Web / iOS / Windows build targets
- [ ] Live-watch for filesystem changes
- [ ] Export (notes, vault, annotated PDFs)
- [ ] A2A protocol for Claude Code integration

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for full release notes.

## License

MIT
