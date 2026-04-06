# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Axiomatic

Solarized-themed desktop + mobile PDF reader for math textbooks. Tauri 2 + React 19 + TypeScript.

## Quick reference

```
src/pages/OverviewPage.tsx       — library grid (starred section + per-directory sections)
src/pages/ReaderPage.tsx         — PDF viewer + notes split-pane + tabs + snip mode
src/pages/LoopPage.tsx           — snip review carousel (sorted/shuffled modes)
src/pages/SnipsPage.tsx          — cross-book snip browsing, filtering, bulk tagging
src/pages/StatsPage.tsx          — study statistics dashboard (XP, sessions, progress)
src/components/PdfViewer.tsx     — virtual-scroll PDF renderer (buffer=5 pages, imperative zoom)
src/components/NotesPanel.tsx    — CodeMirror 6 with vim, markdown, KaTeX math
src/components/TabBar.tsx        — horizontal tab strip with context menu (close, close others)
src/components/AnnotationPanel.tsx — unified highlights + bookmarks list (variant prop)
src/components/OutlineSidebar.tsx — PDF outline/TOC sidebar with collapsible sections
src/components/CommandPalette.tsx — Ctrl+P command palette (panel toggles, theme, zen mode, snip, loop)
src/components/ReaderToolbar.tsx — reader toolbar (back, page counter, zoom, search, pomodoro, palette)
src/components/SnipOverlay.tsx   — drag-to-select crosshair overlay for snip region capture
src/components/SnipBanner.tsx    — inline label input banner shown after snip region selection
src/components/LoopCarousel.tsx  — flashcard carousel with reveal, prev/next, XP tracking
src/components/ZoomableSnipImage.tsx — pinch/scroll-zoomable snip region viewer
src/components/PomodoroTimer.tsx — study timer with presets and break notifications
src/components/BreakOverlay.tsx  — pomodoro break notification overlay
src/components/SnipTagManager.tsx — snip tag CRUD management
src/components/SnipTagAssigner.tsx — tag assignment UI for snips
src/components/StudyStats.tsx    — XP/study statistics visualization
src/components/DirectoryExplorer.tsx — library directory management UI
src/components/SlugMigrationDialog.tsx — orphan slug detection + migration dialog
src/lib/thumbnail-queue.ts      — concurrency limiter (MAX_CONCURRENT=3)
src/lib/palette.ts              — module-level toggle callback for command palette
src/lib/readerState.ts          — module-level store bridging ReaderPage state to Layout/palette
src/lib/platform.ts             — platform detection (mobile/desktop classification)
src/lib/pdfium-url.ts           — pdfium:// URL builder (desktop) / http://pdfium.localhost (Android)
src/lib/render-config.ts        — adaptive render config (DPR, concurrency, buffer per platform)
src/hooks/useTheme.ts           — theme store with setTheme() export for direct setting
src/hooks/useSnips.ts           — snip CRUD + XP tracking (IPC → .axiomatic/ JSON)
src/hooks/usePomodoroTimer.ts   — pomodoro session state + timer logic
src/hooks/useSnipTagDefs.ts     — snip tag definitions CRUD
src/hooks/useSwipe.ts           — touch swipe gesture detection (left/right/tap)
src/hooks/usePinchZoom.ts       — two-finger pinch zoom gesture handling
src/extensions/                 — CodeMirror 6 plugins (editor-theme, image-paste, math-decoration)
src-tauri/src/commands.rs        — general Tauri IPC commands (db, files, tags, project state)
src-tauri/src/highlight_commands.rs — highlight CRUD IPC commands
src-tauri/src/snip_commands.rs   — snip CRUD IPC commands (tags, bulk ops)
src-tauri/src/session_commands.rs — pomodoro session logging IPC commands
src-tauri/src/pdf_commands.rs    — PDF-specific IPC commands (open, outline, links, text, search, clip)
src-tauri/src/pdf_engine.rs      — PDFium render thread (mpsc recv loop, LRU cache)
src-tauri/src/pdf_protocol.rs    — pdfium:// custom protocol handler
src-tauri/src/json_storage.rs    — JSON file storage abstraction for .axiomatic/ state
src-tauri/src/db.rs              — SQLite schema + versioned migration framework
src-tauri/src/folder_picker.rs   — native folder picker (Android ACTION_OPEN_DOCUMENT_TREE bridge)
```

## Architecture

```
React (Vite + SWC)  <──IPC──>  Tauri/Rust  <───>  SQLite
                    <──pdfium://>  PDFium   <───>  File system (PDF dirs)
```

PDF rendering uses PDFium (C library) via `pdfium-render` crate. Pages served as JPEG via `pdfium://` custom protocol. Render thread handles page rendering, text extraction, outlines, links, search, and clipping. Document open runs on `spawn_blocking` (off the render thread) for instant response.

Routes: `/` OverviewPage, `/read/:slug` ReaderPage, `/loop/:slug` LoopPage, `/snips` SnipsPage, `/stats` StatsPage. Layout wraps all with custom Titlebar.

## State management

| Data | Where | Pattern |
|------|-------|---------|
| Progress (page/total) | `.axiomatic/progress.json` | IPC `get_all_progress`/`save_progress`, 300ms debounced writes |
| Starred books | `.axiomatic/starred.json` | IPC `get_starred`/`toggle_starred`, optimistic toggle |
| Snips | `.axiomatic/snips.json` | IPC `list_snips`/`create_snip`/`delete_snip`, UUID IDs |
| Snip XP | `.axiomatic/xp.json` | IPC `get_xp`/`increment_xp`, per-slug counter |
| Theme | localStorage | custom store with OS detection (dbus + matchMedia) |
| Notes | SQLite | in-memory Map cache, 150ms debounced writes |
| Highlights | SQLite | `useHighlights` hook, bookmarks stored as `color="bookmark"` |
| Snip tags | `.axiomatic/snip_tag_defs.json` | IPC `create_snip_tag_def`/`list_snip_tag_defs`, per-snip tag arrays |
| Pomodoro sessions | `.axiomatic/sessions.json` | IPC `log_session`/`list_sessions`, per-slug session history |
| Tabs | localStorage | `useTabs` hook with reopen stack + `useTabNavigation` for route-aware nav |

`createLocalStorageStore` (lib/createStore.ts) is a generic factory for remaining localStorage state (theme, tabs): `load()` returns parsed snapshot, `emitChange()` re-reads from localStorage and notifies subscribers.

**Three-tier storage:** SQLite (structured relational: notes, highlights, tags), `.axiomatic/` ProjectStateDir (portable per-book JSON: progress, starred, snips, XP), localStorage (ephemeral UI: theme, tabs). Each library directory has its own `.axiomatic/` dir — copying the library folder preserves all per-book state.

## Performance-critical paths

**Thumbnail pipeline** — see `docs/pdf-pipeline.md`. Thumbnails are `<img>` tags pointing at `pdfium://` URLs. `thumbnail-queue.ts` limits concurrent loads to 3; no IndexedDB cache needed.

**Zoom** — two-tier imperative system. Immediate: CSS `transform: scale()` via `useImperativeHandle` (no React re-render). Committed: 300ms debounced `startTransition` re-render for layout recalculation. See `docs/pdf-pipeline.md` for details.

**Document open** — `open_document` runs on `spawn_blocking`, not the render thread. Generation counter (`AtomicU64`) preempts stale renders. Module-level caches in `useDocument` and `useTextbooks` avoid re-fetching on navigation.

**OverviewPage re-renders** — `BookTile` is `memo`'d with a custom comparator that checks `progress.currentPage` and `progress.totalPages` by value (not reference), because the localStorage store creates fresh objects on every read. `handleTotalPages` uses a ref to avoid depending on the `progress` object.

**useBatchedRender** — progressively mounts BookTiles in batches of 20 via requestAnimationFrame, preventing initial load from blocking the main thread.

## Command palette & zen mode

**Command palette** (`Ctrl+P` or toolbar button) — floating overlay with fuzzy filter. Available on both overview and reader pages. Commands:
- Always: theme switching (OS / light / dark)
- Reader only: toggle outline, notes, bookmarks, highlights, zen mode, snip mode
- Reader only (when snips exist): loop sorted, loop shuffled
- Overview: stats page navigation

Panel toggle commands dispatch `CustomEvent` on `window` (e.g. `axiomatic:toggle-outline`), listened to by `ReaderPage`. The palette button uses a module-level callback (`src/lib/palette.ts`) to avoid circular imports between `router.tsx` and page/component modules.

**Zen mode** — hides toolbar, tabs, outline, bookmarks, and highlights panels. Notes remain openable (Ctrl+L or command palette). ESC exits zen mode.

**Toolbar layout** (reader): Left (back, page counter, zoom) | Center (title) | Right (search, palette button).

**Keyboard safety** — `useVimReader` and `ReaderPage` keyboard handlers skip all non-modifier keys when `document.activeElement` is an `<input>` or `<textarea>`, preventing vim navigation from interfering with the command palette, search bar, or any future text fields.

## Snip mode & loop review

**Snip mode** — activated via command palette. Renders a `SnipOverlay` (crosshair cursor) on each visible PDF page. Drag to select a normalized rect (0–1 coordinates). On mouseup, `SnipBanner` appears for labeling. Saved snips persist to `.axiomatic/snips.json` via `snip_commands.rs` (UUID IDs, ISO-8601 timestamps).

**Reader state bridge** — `readerState.ts` is a module-level store (not React state) that exposes `snipMode` and `hasSnips` to the Layout/command palette via `useSyncExternalStore`. ReaderPage writes; router.tsx reads. This avoids prop drilling across the route boundary.

**Loop page** (`/loop/:slug`) — carousel of snips for a given book. Modes: sorted (creation order) or shuffled (Fisher-Yates, computed once on mount). Navigation: j/k or arrow keys, Space to reveal, ESC to exit. XP counter persisted per-slug in `.axiomatic/xp.json` via IPC. `LoopCarousel` crops the snip region from a full-page `pdfium://` render using canvas `drawImage`.

**Route-aware tabs** — `OpenTab` now carries a `route` field. `useTabNavigation` wraps `useTabs` with `navigate()` calls that respect the stored route, enabling non-reader tabs (e.g. loop tabs with slug `loop:{slug}`).

## Pomodoro & study statistics

**Pomodoro timer** — `PomodoroTimer` component with configurable presets (25/5, 50/10, custom). `usePomodoroTimer` manages countdown state, auto-transitions between work/break phases, and fires `BreakOverlay` notifications. Sessions logged to `.axiomatic/sessions.json` via `session_commands.rs`.

**Study stats** — `StatsPage` (`/stats`) shows XP aggregation, session history, and per-directory progress. `StudyStats` component renders the dashboard on OverviewPage as well.

## Snip tags & cross-book filtering

**Snip tags** — tag definitions stored in `.axiomatic/snip_tag_defs.json` (name + color). Tags assigned per-snip as string arrays. `SnipTagManager` for CRUD, `SnipTagAssigner` for assignment. Bulk tag operations supported via context menu in SnipsPage.

**Cross-book snips** — `SnipsPage` (`/snips`) aggregates snips across all library directories. Supports AND tag filtering, search, vim navigation (j/k), and inline loop overlay carousel.

## Mobile support (Android)

Platform detection via `src/lib/platform.ts`. Adaptive render config (lower DPR, concurrency, buffer on mobile). Touch gestures: `useSwipe` (left/right/tap navigation), `usePinchZoom` (two-finger zoom). `ZoomableSnipImage` for pinch-zoomable snip regions. Android uses `http://pdfium.localhost` instead of `pdfium://` protocol. `FolderPickerPlugin` (Kotlin) for native directory picker.

## Conventions

- Solarized palette: hard-coded hex values (`#fdf6e3` light bg, `#002b36` dark bg, etc.)
- Tailwind 4 with `dark:` variants; dark mode toggled via `<html class="dark">`
- Vim keybindings everywhere: h/j/k/l in overview grid, j/k scroll in reader, full vim in notes editor
- No component library — all UI is hand-written
- PDFs rendered via `pdfium://` custom protocol (native PDFium, JPEG output)
- **Test-before-modify rule**: Before changing any logic, verify it has test coverage. If not, extract into a testable unit and write tests FIRST. This applies to all logic — component wiring, command lists, state assembly — not just leaf components. Tests must assert desired behavior, not mirror current implementation.
- **Pre-release gate**: Always run `./scripts/prebuild.sh <version>` before pushing a release tag. Never tag manually. The script runs the full lint → typecheck → test pipeline and only tags if everything passes.

## Commands

```bash
npm run dev          # tauri dev (vite + rust)
npm run build        # tauri build
npm run vite:dev     # vite only (no tauri)
npm run vite:build   # tsc -b + vite build (no tauri)
npx tsc -b           # type-check (same as build uses)
npm run lint         # eslint
npm run test         # vitest unit tests (399 tests)
npm run test:e2e     # playwright E2E tests (requires vite dev server)
cargo test --lib     # rust unit tests (73 tests, from src-tauri/)

# Run a single vitest file
npx vitest run src/hooks/__tests__/useVimReader.test.ts

# Run a single rust test
cd src-tauri && cargo test --lib test_name
```

## Release workflow

```bash
./scripts/prebuild.sh <version>   # bump, lint, fix, test, commit, tag
git push origin master --tags     # push commit + tag → triggers CI release
```

## CI/CD

- `.github/workflows/ci.yml` — lint, typecheck, vitest, rust tests on push/PR
- `.github/workflows/release.yml` — full pipeline + tauri build on tag push (AppImage/deb/rpm to GitHub Releases)

## Known gotchas

- PDFium shared library (`libpdfium.so`/`.dylib`/`.dll`) must be in `src-tauri/resources/` for dev or bundled as a Tauri resource for production. Download from https://github.com/bblanchon/pdfium-binaries.
- `Pdfium` is `Box::leak`'d to `&'static` — shared via `PdfiumHandle` wrapper (unsafe Send+Sync) and `usize` pointer casts for closures. See `lib.rs` setup.
- Bookmarks are highlights with `color = "bookmark"` — `useHighlights` splits them via `colorHighlights` / `bookmarkHighlights`.
- **Slug migration** — When a PDF is renamed, `detect_orphaned_slugs` finds data referencing unknown slugs and suggests mappings via bigram similarity. `migrate_slug` atomically updates all storage tiers (SQLite + JSON + localStorage tabs). The `SlugMigrationDialog` surfaces after library scan on OverviewPage.
- **Versioned migrations** — `db.rs` uses a `migrations` table with sequential version numbers. Add new migrations to the `MIGRATIONS` array; `init_db()` runs pending ones on startup.
