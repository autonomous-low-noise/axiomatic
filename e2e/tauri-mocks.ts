/**
 * Tauri IPC mock helpers for Playwright E2E tests.
 *
 * When the Vite dev server is loaded in a real browser (not the Tauri
 * WebView), the `@tauri-apps/api` calls fail because `window.__TAURI__`
 * is undefined and the `pdfium://` custom protocol is not registered.
 *
 * These helpers inject mock implementations via `page.addInitScript` and
 * `page.route` so the React app renders with fixture data.
 *
 * Each test can override specific IPC responses by passing a custom
 * `ipcHandlers` map to `installTauriMocks`.
 */

import type { Page } from '@playwright/test'

/** A single textbook entry as returned by the `list_textbooks` IPC. */
export interface MockTextbook {
  slug: string
  title: string
  full_path: string
  dir_path: string
  dir_id: number
}

/** A single highlight entry as returned by the `list_highlights` IPC. */
export interface MockHighlight {
  id: number
  slug: string
  page: number
  x: number
  y: number
  width: number
  height: number
  color: string
  note: string
  text: string
  group_id: string
  created_at: string
}

/** A single snip entry as returned by the `list_snips` IPC. */
export interface MockSnip {
  id: string
  slug: string
  full_path: string
  page: number
  label: string
  x: number
  y: number
  width: number
  height: number
  created_at: string
  tags: string[]
}

/** Default fixture textbooks for the library grid. */
export const FIXTURE_TEXTBOOKS: MockTextbook[] = [
  {
    slug: 'calculus-early-transcendentals',
    title: 'Calculus: Early Transcendentals',
    full_path: '/mock/library/Calculus Early Transcendentals.pdf',
    dir_path: '/mock/library',
    dir_id: 1,
  },
  {
    slug: 'linear-algebra-done-right',
    title: 'Linear Algebra Done Right',
    full_path: '/mock/library/Linear Algebra Done Right.pdf',
    dir_path: '/mock/library',
    dir_id: 1,
  },
  {
    slug: 'topology-munkres',
    title: 'Topology (Munkres)',
    full_path: '/mock/library/Topology Munkres.pdf',
    dir_path: '/mock/library',
    dir_id: 1,
  },
]

/** Default fixture directories. */
export const FIXTURE_DIRECTORIES = [
  { id: 1, path: '/mock/library', label: 'Library' },
]

/** Default fixture progress map. */
export const FIXTURE_PROGRESS: Record<string, { currentPage: number; totalPages: number; lastReadAt: string }> = {
  'calculus-early-transcendentals': { currentPage: 42, totalPages: 800, lastReadAt: '2025-01-15T10:00:00Z' },
  'linear-algebra-done-right': { currentPage: 1, totalPages: 350, lastReadAt: '2025-01-10T09:00:00Z' },
}

/** Default fixture document info (returned by open_document). */
export const FIXTURE_DOC_INFO = {
  page_count: 800,
  page_sizes: Array.from({ length: 10 }, () => ({ width: 612, height: 792 })),
}

/** Default fixture snips. */
export const FIXTURE_SNIPS: MockSnip[] = [
  {
    id: 'snip-001',
    slug: 'calculus-early-transcendentals',
    full_path: '/mock/library/Calculus Early Transcendentals.pdf',
    page: 5,
    label: 'Chain rule formula',
    x: 0.1,
    y: 0.2,
    width: 0.6,
    height: 0.3,
    created_at: '2025-01-16T10:00:00Z',
    tags: [],
  },
  {
    id: 'snip-002',
    slug: 'calculus-early-transcendentals',
    full_path: '/mock/library/Calculus Early Transcendentals.pdf',
    page: 12,
    label: 'Integration by parts',
    x: 0.15,
    y: 0.3,
    width: 0.5,
    height: 0.25,
    created_at: '2025-01-16T11:00:00Z',
    tags: [],
  },
  {
    id: 'snip-003',
    slug: 'calculus-early-transcendentals',
    full_path: '/mock/library/Calculus Early Transcendentals.pdf',
    page: 20,
    label: 'Fundamental theorem',
    x: 0.2,
    y: 0.15,
    width: 0.55,
    height: 0.35,
    created_at: '2025-01-16T12:00:00Z',
    tags: [],
  },
]

/** Default fixture highlights. */
export const FIXTURE_HIGHLIGHTS: MockHighlight[] = []

/**
 * Map of IPC command name -> handler function.
 * Handlers receive the `args` object from invoke() and return the mock response.
 */
export type IpcHandlers = Record<string, (args: Record<string, unknown>) => unknown>

/** Build the default IPC handler map. Tests can merge overrides on top. */
export function defaultIpcHandlers(overrides: Partial<IpcHandlers> = {}): IpcHandlers {
  const base: IpcHandlers = {
    // Library
    list_textbooks: () => FIXTURE_TEXTBOOKS,
    list_directories: () => FIXTURE_DIRECTORIES,
    get_all_progress: () => FIXTURE_PROGRESS,
    get_starred: () => ({}),
    detect_orphaned_slugs: () => [],
    get_platform: () => 'linux',
    list_tags: () => [],
    list_book_tags: () => ({}),

    // Reader
    open_document: () => FIXTURE_DOC_INFO,
    get_outline: () => [],
    list_highlights: () => FIXTURE_HIGHLIGHTS,
    save_progress: () => null,
    prerender_pages: () => null,
    get_note: () => '',

    // Snips
    list_snips: () => FIXTURE_SNIPS,
    get_xp: () => 0,
    create_snip: (args) => ({
      id: `snip-new-${Date.now()}`,
      slug: args.slug ?? 'test',
      full_path: args.fullPath ?? '/mock/test.pdf',
      page: args.page ?? 1,
      label: args.label ?? 'Test snip',
      x: args.x ?? 0,
      y: args.y ?? 0,
      width: args.width ?? 0.5,
      height: args.height ?? 0.5,
      created_at: new Date().toISOString(),
      tags: [],
    }),
    increment_xp: () => 1,

    // Highlights
    create_highlight: (args) => ({
      id: Date.now(),
      slug: args.slug ?? 'test',
      page: args.page ?? 1,
      x: args.x ?? 0,
      y: args.y ?? 0,
      width: args.width ?? 0.1,
      height: args.height ?? 0.02,
      color: args.color ?? '#facc15',
      note: args.note ?? '',
      text: args.text ?? '',
      group_id: args.groupId ?? 'group-1',
      created_at: new Date().toISOString(),
    }),
    delete_highlight: () => null,
    delete_highlight_group: () => null,
  }

  return { ...base, ...overrides }
}

/**
 * Install Tauri IPC mocks into the page.
 *
 * This injects a `window.__TAURI_INTERNALS__` shim that intercepts
 * all `invoke()` calls and routes them through the handlers map.
 * It also intercepts `pdfium://` protocol requests, serving a 1x1
 * transparent PNG as a placeholder for thumbnail/page renders.
 */
export async function installTauriMocks(
  page: Page,
  handlers: IpcHandlers = defaultIpcHandlers(),
): Promise<void> {
  // Serialize the handlers map for injection. Since handler functions
  // cannot be serialized via JSON, we pass the response data as a
  // static lookup and eval each handler string on the page side.
  //
  // Approach: pre-compute all responses for known commands, and inject
  // a simple command -> response lookup. For commands that need args
  // (like create_snip), we build a small inline function.
  const staticResponses: Record<string, unknown> = {}
  for (const [cmd, handler] of Object.entries(handlers)) {
    // Call each handler with empty args to get the default response.
    // This works for all our read-only fixtures.
    try {
      staticResponses[cmd] = handler({})
    } catch {
      staticResponses[cmd] = null
    }
  }

  await page.addInitScript((responses) => {
    // Create the __TAURI_INTERNALS__ mock that @tauri-apps/api/core
    // checks for. The invoke function returns fixture data.
    const ipcResponses = responses as Record<string, unknown>

    // Track created highlights across calls within a page session
    const sessionHighlights: Array<Record<string, unknown>> = []
    let highlightIdCounter = 1000

    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      value: {
        invoke: (cmd: string, args?: Record<string, unknown>) => {
          // Dynamic handlers for stateful commands
          if (cmd === 'create_highlight' && args) {
            const hl = {
              id: highlightIdCounter++,
              slug: args.slug ?? 'test',
              page: args.page ?? 1,
              x: args.x ?? 0,
              y: args.y ?? 0,
              width: args.width ?? 0.1,
              height: args.height ?? 0.02,
              color: args.color ?? '#facc15',
              note: args.note ?? '',
              text: args.text ?? '',
              group_id: args.groupId ?? `group-${highlightIdCounter}`,
              created_at: new Date().toISOString(),
            }
            sessionHighlights.push(hl)
            return Promise.resolve(hl)
          }

          if (cmd === 'list_highlights') {
            // Return fixture highlights merged with session-created ones
            const base = (ipcResponses['list_highlights'] ?? []) as Array<Record<string, unknown>>
            return Promise.resolve([...base, ...sessionHighlights])
          }

          if (cmd === 'create_snip' && args) {
            const snip = {
              id: `snip-new-${Date.now()}`,
              slug: args.slug ?? 'test',
              full_path: args.fullPath ?? '/mock/test.pdf',
              page: args.page ?? 1,
              label: args.label ?? 'Test snip',
              x: args.x ?? 0,
              y: args.y ?? 0,
              width: args.width ?? 0.5,
              height: args.height ?? 0.5,
              created_at: new Date().toISOString(),
              tags: [],
            }
            return Promise.resolve(snip)
          }

          if (cmd === 'increment_xp') {
            return Promise.resolve(1)
          }

          if (cmd === 'save_progress') {
            return Promise.resolve(null)
          }

          if (cmd in ipcResponses) {
            return Promise.resolve(ipcResponses[cmd])
          }

          console.warn(`[tauri-mock] Unhandled IPC command: ${cmd}`, args)
          return Promise.resolve(null)
        },
        convertFileSrc: (path: string) => path,
        transformCallback: () => 0,
      },
      writable: false,
      configurable: false,
    })

    // Also mock the dialog plugin's open() to simulate directory selection
    Object.defineProperty(window, '__TAURI_PLUGIN_DIALOG__', {
      value: {
        open: () => Promise.resolve('/mock/library'),
      },
      writable: false,
      configurable: false,
    })
  }, staticResponses)

  // Intercept pdfium:// protocol requests — serve a 1x1 transparent PNG
  // so <img> tags don't break. In a real Tauri app these go to the Rust
  // PDF engine; in browser tests we just need the images to "load".
  await page.route('**/pdfium://**', (route) => {
    // 1x1 transparent PNG
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
      'base64',
    )
    route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: png,
    })
  })

  // Also intercept pdfium://localhost paths (the actual format used by the app)
  await page.route('**/render?**', (route) => {
    const url = route.request().url()
    if (url.includes('pdfium://') || url.includes('pdfium%3A')) {
      const png = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        'base64',
      )
      route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: png,
      })
    } else {
      route.continue()
    }
  })
}
