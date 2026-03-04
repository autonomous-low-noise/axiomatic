/**
 * Playwright E2E configuration for the Axiomatic PDF reader.
 *
 * Current approach: tests run against the Vite dev server (npm run vite:dev)
 * on port 5173. This covers all frontend UI logic that runs inside the
 * Tauri WebView, while avoiding the complexity of launching the full
 * native Tauri binary.
 *
 * Tauri IPC calls (`@tauri-apps/api/core` invoke, `@tauri-apps/plugin-dialog`,
 * `pdfium://` protocol) will fail in a plain browser. Tests mock these via
 * `page.addInitScript` and `page.route` to provide fixture data.
 *
 * ---
 * Extending to full Tauri E2E testing
 * ---
 * To test against the real Tauri app (including native IPC, file system,
 * and PDFium rendering), switch to one of these strategies:
 *
 * 1. **tauri-driver (WebDriver)** — the officially recommended approach.
 *    Install `tauri-driver` (`cargo install tauri-driver`), build the app
 *    (`npm run build`), then configure Playwright to connect via CDP or
 *    WebDriver to the Tauri WebView. See:
 *    https://v2.tauri.app/develop/tests/webdriver/
 *
 * 2. **Electron-style approach** — launch the built binary as a subprocess,
 *    connect Playwright via CDP to the WebView debug port. Requires
 *    `WEBKIT_INSPECTOR_SERVER` env var on Linux/macOS or remote-debugging
 *    on Windows.
 *
 * For now, the Vite dev server approach gives fast feedback on UI behavior
 * and is sufficient for verifying component interactions, routing, and
 * state management.
 */

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Uncomment to add WebKit (closest to Tauri's WebView on macOS/Linux):
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  /**
   * Start the Vite dev server before running tests.
   * The `reuseExistingServer` flag means that if you already have
   * `npm run vite:dev` running, Playwright will connect to it instead
   * of spawning a second instance.
   */
  webServer: {
    command: 'npm run vite:dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
})
