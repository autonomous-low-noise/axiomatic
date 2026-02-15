# PDF rendering pipeline

All PDF operations are handled natively by [PDFium](https://pdfium.googlesource.com/pdfium/) via the `pdfium-render` Rust crate. Two separate flows: **thumbnails** (OverviewPage) and **full viewer** (ReaderPage).

## Architecture overview

```
┌── Frontend (React) ──────────────────────────────────────────────┐
│                                                                  │
│  PdfThumbnail ─── <img src="pdfium://…">                         │
│  PdfViewer    ─── <img src="pdfium://…"> (per visible page)      │
│                                                                  │
│  invoke('open_document')  ─→ Tauri IPC ─→ spawn_blocking         │
│  invoke('get_outline')    ─→ Tauri IPC ─→ render thread          │
│  invoke('get_page_links') ─→ Tauri IPC ─→ render thread          │
│  invoke('extract_page_text') ─→ Tauri IPC ─→ render thread       │
│  invoke('search_document')   ─→ Tauri IPC ─→ render thread       │
│  invoke('clip_pdf')          ─→ Tauri IPC ─→ render thread       │
│  invoke('get_page_text_layer') ─→ Tauri IPC ─→ render thread     │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌── Rust (Tauri) ─────────────────────────────────────────────────┐
│                                                                  │
│  setup():                                                        │
│    Pdfium::bind_to_library() ─→ Box::leak() ─→ &'static Pdfium  │
│    spawn render thread (owns mpsc::Receiver<PdfRequest>)         │
│    manage(PdfState { sender, generation, pdfium: PdfiumHandle }) │
│                                                                  │
│  pdfium:// protocol handler (pdf_protocol.rs):                   │
│    parse URL params ─→ send RenderPage to render thread          │
│    block on sync_channel ─→ return JPEG bytes                    │
│                                                                  │
│  render thread (pdf_engine.rs):                                  │
│    PdfEngine { documents: HashMap, render_cache: LRU(50) }       │
│    recv loop: RenderPage | CloseDocument | GetOutline | ...      │
│                                                                  │
│  open_document (pdf_commands.rs):                                │
│    runs on spawn_blocking, NOT the render thread                 │
│    bumps generation counter to preempt stale renders             │
│    loads PDF, reads page 1 dimensions, returns DocumentInfo      │
└──────────────────────────────────────────────────────────────────┘
```

## PDFium initialization

PDFium's shared library (`libpdfium.so` / `libpdfium.dylib` / `pdfium.dll`) is loaded eagerly during `setup()`:

1. Check Tauri resource dir
2. Fallback to `resources/` and `src-tauri/resources/` (development)
3. `Pdfium::bind_to_library()` → `Box::leak()` → `&'static Pdfium`

The leaked `&'static Pdfium` is shared via:
- `PdfiumHandle` wrapper (unsafe `Send + Sync`) stored in `PdfState` for IPC commands
- `usize` pointer cast for the render thread spawn closure (Rust 2021 closure field capture prevents simpler wrapper approaches)

## Thumbnail pipeline

Renders page 1 of each PDF as a 200px-wide JPEG. Uses a two-phase approach: pre-render off the main thread via IPC, then mount `<img>` for a guaranteed cache hit.

**Why not mount `<img>` directly?** On Linux/WebKitGTK, `pdfium://` protocol callbacks run on the **main thread**. A cache miss blocks the main thread via `rx.recv()` while the render thread loads the PDF + renders page 1 (200ms–1s). With 3 concurrent thumbnails, aggressive scrolling causes 1.5s+ continuous main-thread blocking — enough for Ubuntu to show an "unresponsive app" dialog.

```
BookTile
  └── PdfThumbnail(fullPath)

             ┌─ not in viewport ──→ render sentinel div (lightweight)
             │
  visible? ──┤
             │
             └─ in viewport (IntersectionObserver, 200px margin)
                     │
                     ▼
              acquireSlot() — wait for concurrency slot (MAX_CONCURRENT=3)
                     │
                     ▼
              invoke('prerender_pages', { path, pages: [1], width: 200, dpr: 1 })
                → runs on spawn_blocking, NOT the main thread
                → render thread loads PDF + renders page 1
                → result cached in SharedRenderCache
                     │
                     ▼
              release slot, set cached = true
                     │
                     ▼
              mount <img src="pdfium://localhost/render?path=...&page=1&width=200&dpr=1">
                → protocol handler checks SharedRenderCache → HIT
                → instant response, zero main-thread blocking
```

No IndexedDB cache — the browser's built-in image cache handles repeated loads, and the render thread's LRU cache (50 entries) handles the Rust side. The `prerender_pages` IPC call ensures the render cache is warm before the `<img>` triggers the protocol handler.

### Key files

| File | Role |
|------|------|
| `components/PdfThumbnail.tsx` | Visibility detection, slot acquisition, `<img>` mount |
| `lib/thumbnail-queue.ts` | Concurrency limiter: `acquireSlot()` returns a release function |

## Full PDF viewer pipeline

Used by `ReaderPage` → `PdfViewer` component.

### Document open

`open_document` runs on `spawn_blocking` (NOT the render thread) for instant response:

1. Bump `generation` counter (`AtomicU64::fetch_add`) — all queued renders from a previous document become stale
2. Load PDF via `pdfium.load_pdf_from_file()`
3. Read page 1 dimensions, fill all pages with same aspect ratio
4. Return `DocumentInfo { doc_id, page_count, pages: Vec<PageDimension> }`

The render thread lazily opens the document via `ensure_document()` on first render request.

### Page rendering

Pages are rendered as JPEG images via the `pdfium://` custom protocol:

```
PdfViewer scroll handler
  │
  ▼
calculate visible range (binary search on cumulative page offsets)
  │
  ▼
for each visible page (±5 buffer):
  mount <img src="pdfium://localhost/render?path={encoded}&page={n}&width={px}&dpr={ratio}">
```

Protocol handler (`pdf_protocol.rs`):
1. Parse query params (`path`, `page`, `width`, `dpr`)
2. Tag request with current `generation` value
3. Send `PdfRequest::RenderPage` to render thread via `mpsc`
4. Block on `sync_channel` response
5. Return `200 image/jpeg` with `Cache-Control: max-age=3600, immutable`

Render thread (`pdf_engine.rs`):
1. Check `generation` — if stale, return `Err("preempted")` immediately
2. Check LRU cache — if hit, return cached JPEG
3. `ensure_document()` — load PDF if not cached
4. Render page at `width * dpr` pixels via PDFium
5. Encode to JPEG (quality 90) via `image::codecs::jpeg::JpegEncoder`
6. Store in LRU cache (50 entries), return bytes

### Virtual scrolling

PdfViewer renders only visible pages plus a buffer of 5 pages above and below. Page visibility is calculated from scroll position and cumulative page heights. A `requestAnimationFrame`-debounced scroll handler updates the visible range.

```
scroll container (overflow-y: auto)
  └── spacer div (total height of all pages × scale factor)
      └── content div (CSS transform: scale for intermediate zoom)
          └── absolutely positioned <img> elements (only for visible range)
              └── TextLayer overlay (character-level bounding boxes)
```

### Zoom

Continuous zoom range: 0.25x–5.0x, factor 1.1x per step. Two-tier system:

1. **Immediate** — `applyZoom()` via `useImperativeHandle`: sets CSS `transform: scale()` on content div, adjusts spacer height and scroll position. No React re-render.
2. **Committed** — after 300ms debounce, `startTransition(() => setCommittedZoom(newZoom))` triggers layout recalculation with correct image dimensions. Interruptible by further zoom changes.

### Text layer

Each visible page gets a `TextLayer` overlay with character-level bounding boxes from PDFium. Loaded 500ms after page render to avoid competing with initial visible page renders.

Text layer data comes from `get_page_text_layer` (via render thread), which:
- Iterates all characters in the page
- Extracts loose bounds (PDF coordinates)
- Normalizes to 0–1 range (flipping Y axis from bottom-up to top-down)
- Groups into spans by line breaks and word gaps

### Search

`search_document` (via render thread) performs case-insensitive text search across all pages. Results returned as `SearchResult { page, match_index, rects }`.

### Dark mode

PDF images are inverted + hue-rotated in dark mode via CSS filter:
`filter: invert(1) hue-rotate(180deg)`. Preserves color diagrams while making white backgrounds dark.

---

## Render thread request types

| Request | Handler | Notes |
|---------|---------|-------|
| `RenderPage` | `render_page()` | Generation-checked, LRU-cached, JPEG output |
| `CloseDocument` | `close_document()` | Drops cached `PdfDocument` |
| `GetOutline` | `get_outline()` | Recursive bookmark tree traversal |
| `GetPageLinks` | `get_page_links()` | Normalized link rects + internal/external targets |
| `ExtractPageText` | `extract_page_text()` | Full page text as string |
| `SearchDocument` | `search_document()` | Case-insensitive search across all pages |
| `ClipPdf` | `clip_pdf()` | Copy page range to new PDF file |
| `GetPageTextLayer` | `get_page_text_layer()` | Character-level bounding boxes for text selection |
