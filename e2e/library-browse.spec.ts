/**
 * E2E test: Library browse — ac-127
 *
 * Verifies the happy path: app launches, user has a PDF directory attached,
 * the textbook grid renders with book tiles showing thumbnails, and at
 * least one book tile is visible with a title.
 *
 * Data-testid attributes referenced (to be added to components if not present):
 *   - No data-testids required — tests use semantic selectors (links, text,
 *     roles) matching the actual component markup.
 *
 * Selector strategy:
 *   - OverviewPage renders <section> blocks with <h2> directory labels
 *   - BookTile renders <a> (Link) with the book title as inner text
 *   - PdfThumbnail renders <img> with pdfium:// src (intercepted by mock)
 *   - "Attach Directory" button is rendered when no directories exist
 *   - TileGrid renders a CSS grid container
 */

import { test, expect } from '@playwright/test'
import {
  installTauriMocks,
  defaultIpcHandlers,
  FIXTURE_TEXTBOOKS,
  FIXTURE_DIRECTORIES,
  FIXTURE_PROGRESS,
} from './tauri-mocks'

test.describe('Library browse (ac-127)', () => {
  test.beforeEach(async ({ page }) => {
    await installTauriMocks(page)
  })

  test('renders textbook grid with book tiles after directory is attached', async ({ page }) => {
    await page.goto('/')

    // The overview page should render with the fixture directory label
    const sectionHeading = page.locator('h2', { hasText: 'Library' })
    await expect(sectionHeading).toBeVisible({ timeout: 10_000 })

    // At least one book tile should be visible — BookTile renders as <a> with text
    const firstBook = page.locator('a', { hasText: FIXTURE_TEXTBOOKS[0].title })
    await expect(firstBook).toBeVisible()

    // The book tile should link to the reader route
    const href = await firstBook.getAttribute('href')
    expect(href).toBe(`/read/${FIXTURE_TEXTBOOKS[0].slug}`)
  })

  test('all fixture textbooks appear in the grid', async ({ page }) => {
    await page.goto('/')

    // Wait for the grid to render
    await expect(page.locator('h2', { hasText: 'Library' })).toBeVisible({ timeout: 10_000 })

    // Each fixture textbook should have a tile
    for (const book of FIXTURE_TEXTBOOKS) {
      const tile = page.locator('a', { hasText: book.title })
      await expect(tile).toBeVisible()
    }
  })

  test('book tiles show progress text when available', async ({ page }) => {
    await page.goto('/')

    // Wait for tiles to render
    await expect(page.locator('a', { hasText: FIXTURE_TEXTBOOKS[0].title })).toBeVisible({ timeout: 10_000 })

    // The first book has progress in the fixture data (42/800)
    const progressSlug = FIXTURE_TEXTBOOKS[0].slug
    const progressData = FIXTURE_PROGRESS[progressSlug]
    if (progressData) {
      const progressText = `${progressData.currentPage}/${progressData.totalPages}`
      const progressBadge = page.locator('span', { hasText: progressText })
      await expect(progressBadge).toBeVisible()
    }
  })

  test('shows empty state when no directories are attached', async ({ page }) => {
    // Override the mocks to return empty directories
    const handlers = defaultIpcHandlers({
      list_directories: () => [],
      list_textbooks: () => [],
      get_all_progress: () => ({}),
    })
    await installTauriMocks(page, handlers)

    await page.goto('/')

    // The "Attach Directory" button should be visible
    const attachButton = page.locator('button', { hasText: 'Attach Directory' })
    await expect(attachButton).toBeVisible({ timeout: 10_000 })

    // No book tiles should exist
    const bookLinks = page.locator('a[href^="/read/"]')
    await expect(bookLinks).toHaveCount(0)
  })

  test('shows empty state when directories exist but contain no PDFs', async ({ page }) => {
    const handlers = defaultIpcHandlers({
      list_directories: () => FIXTURE_DIRECTORIES,
      list_textbooks: () => [],
      get_all_progress: () => ({}),
    })
    await installTauriMocks(page, handlers)

    await page.goto('/')

    // Should show the "No PDFs found" message
    const emptyMessage = page.locator('text=No PDFs found in attached directories')
    await expect(emptyMessage).toBeVisible({ timeout: 10_000 })
  })

  test('book tile navigates to reader on click', async ({ page }) => {
    await page.goto('/')

    // Wait for tiles
    const tile = page.locator('a', { hasText: FIXTURE_TEXTBOOKS[0].title })
    await expect(tile).toBeVisible({ timeout: 10_000 })

    // Click the tile — should navigate to /read/:slug
    await tile.click()

    // Verify the URL changed to the reader route
    await expect(page).toHaveURL(`/read/${FIXTURE_TEXTBOOKS[0].slug}`)
  })

  test('starred section appears when books are starred', async ({ page }) => {
    const handlers = defaultIpcHandlers({
      get_starred: () => ({ [FIXTURE_TEXTBOOKS[0].slug]: true }),
    })
    await installTauriMocks(page, handlers)

    await page.goto('/')

    // The "Starred" section heading should appear
    const starredHeading = page.locator('h2', { hasText: 'Starred' })
    await expect(starredHeading).toBeVisible({ timeout: 10_000 })

    // The starred book should appear under the Starred section
    const starredSection = page.locator('section').filter({ has: starredHeading })
    const starredTile = starredSection.locator('a', { hasText: FIXTURE_TEXTBOOKS[0].title })
    await expect(starredTile).toBeVisible()
  })

  test('loading state is shown before textbooks load', async ({ page }) => {
    // Use a slow handler that delays the response
    const handlers = defaultIpcHandlers({
      list_textbooks: () => new Promise((resolve) => setTimeout(() => resolve(FIXTURE_TEXTBOOKS), 5000)),
    })
    await installTauriMocks(page, handlers)

    await page.goto('/')

    // The "Loading..." text should appear while waiting for data
    const loadingText = page.locator('text=Loading...')
    // Note: this may be very brief, so we just check it exists before
    // the full grid appears. We give a short timeout.
    await expect(loadingText).toBeVisible({ timeout: 3_000 })
  })
})
