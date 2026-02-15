# Changelog

## v0.1.0

### PDFium migration

Replaced pdfjs-dist (JS-based PDF rendering) with [PDFium](https://pdfium.googlesource.com/pdfium/) via the `pdfium-render` Rust crate. All PDF operations now happen natively in Rust.

- **Custom protocol** — `pdfium://localhost/render?path=...&page=...&width=...&dpr=...` serves page images as JPEG. Both thumbnails and the full viewer use this protocol; no JS worker or IndexedDB cache needed.
- **Render thread** — dedicated `std::thread` processes page renders, text extraction, outline/link queries, clipping, and search via an `mpsc` channel (`pdf_engine.rs`).
- **Off-thread document open** — `open_document` runs on `spawn_blocking`, bypassing the render thread entirely for instant document info retrieval.
- **Generation counter** — `AtomicU64` tags each render request; stale renders (from a previous document) are preempted instantly.
- **JPEG encoding** — pages encoded as JPEG (quality 90) instead of PNG for ~5x faster encoding.
- **LRU render cache** — 50-entry cache avoids re-rendering pages during scroll back-and-forth.
- **Native text layer** — character-level bounding boxes extracted from PDFium for text selection, highlight creation, and search (replaces pdfjs text layer).
- **Native outline & links** — table of contents and hyperlink annotations read directly from PDFium.
- **PDF clipping** — extract page ranges into new PDF files, fully native.

### Highlights & bookmarks

- **Text-selection highlights** — select text on a PDF page, right-click to create a colored highlight (yellow, orange, blue, green). Highlights stored in SQLite with normalized coordinates, text content, and group IDs for multi-rect selections.
- **Bookmarks as transparent highlights** — "Bookmark" option in the context menu creates a highlight with `color = "bookmark"` (no visible overlay). Replaces the old page-level bookmark toggle.
- **Highlights panel** — resizable side pane listing all colored highlights grouped by page, with text previews. Click to navigate; delete individual highlights or groups.
- **Bookmarks panel** — same structure for bookmark-type highlights; resizable, grouped by page.
- **Anchor navigation** — clicking a highlight/bookmark in either pane saves the current reading position and shows a "back to p.X" button in the toolbar. Works the same as search navigation.

### Tabs

- **Tab bar** — horizontal tab strip below the toolbar showing all open documents. Click to switch; X button or middle-click to close.
- **Ctrl+W** — close current tab (navigates to next tab or back to library).
- **Ctrl+Shift+T** — reopen last closed tab.
- **Shift+Alt+H / Shift+Alt+L** — switch to previous / next tab.
- **Tab state persistence** — open tabs stored in `useTabs` hook with reopen stack.

### Performance

- **Imperative zoom** — zoom changes apply instantly via CSS `transform: scale()` (GPU-composited) without React re-renders. Layout re-renders are debounced (300ms) and wrapped in `startTransition` for interruptibility. `PdfViewer` uses `forwardRef` + `useImperativeHandle` + `React.memo`.
- **Continuous zoom** — Ctrl+wheel and toolbar buttons use a continuous zoom model (`MIN_ZOOM=0.25`, `MAX_ZOOM=5`, `ZOOM_FACTOR=1.1`) instead of fixed steps, enabling smooth zooming.
- **Deferred text/link loading** — text layer and link annotations load 500ms after page render to avoid competing with initial visible page renders.
- **Module-level caching** — textbook list (`useTextbooks`) and document info (`useDocument`) cached at module scope; navigating between library and reader doesn't re-fetch.
- **Thumbnail queue** — simplified to a pure concurrency limiter (`thumbnail-queue.ts`, `MAX_CONCURRENT=3`); thumbnails load via `pdfium://` protocol as `<img>` tags — no canvas rendering or IndexedDB caching needed.
- **Off-thread thumbnail prerender** — `PdfThumbnail` calls `prerender_pages` via IPC (`spawn_blocking`) before mounting the `<img>` tag, ensuring the `pdfium://` protocol handler always hits the `SharedRenderCache`. Eliminates main-thread blocking during thumbnail loads — fixes "unresponsive app" dialog on aggressive scroll (Linux/WebKitGTK).

### Layout

- **Resizable panes** — outline, highlights, bookmarks, and notes panes all support drag-to-resize.
- **Outline sidebar** — table of contents rendered from PDFium bookmarks in a collapsible tree; Ctrl+B to toggle.
- **Clip dialog** — select page range and export to a new PDF file.

## v0.0.5

### Added

- **Arrow key navigation in overview grid** — arrow keys now work alongside h/j/k/l for grid navigation (`useVimOverview.ts`)
- **Arrow key scrolling in reader** — arrow up/down scroll the PDF, matching j/k behavior (`useVimReader.ts`)
- **Space to page down in reader** — scrolls one full viewport height (`useVimReader.ts`)
- **Ctrl-h to return to library from reader** — navigates back to the overview page; mirrors existing Ctrl-h (notes → PDF pane) for a consistent "go back one level" pattern (`useVimReader.ts`)
- **Ctrl-+/- zoom in reader** — keyboard zoom in/out through the same steps as the toolbar buttons, works regardless of active pane (`useVimReader.ts`)

### Fixed

- **Light-mode text shimmer on hover** — titles shifted weight when hovering over tiles. Caused by missing global font-smoothing and bare `transition` classes triggering GPU layer promotion that switched text anti-aliasing. Fixed by adding global `-webkit-font-smoothing: antialiased` and removing a no-op hover color class (`index.css`, `BookTile.tsx`)
- **Thumbnail flicker on hover** — thumbnails flickered when moving the cursor quickly across the overview grid. Overlay opacity transitions (star button, tag badges) triggered GPU layer promotion/demotion cycles that forced the entire `overflow:hidden` + `border-radius` stacking context to re-composite. Fixed by removing all CSS transitions from BookTile (hover effects are now instant) and wrapping `PdfThumbnail` in `memo` (`BookTile.tsx`, `PdfThumbnail.tsx`; see `docs/fix-light-mode-text-shimmer.md`)
