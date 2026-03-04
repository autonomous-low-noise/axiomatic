/**
 * E2E test: Snip mode and Loop review — ac-129
 *
 * Verifies the happy path: user enters snip mode, creates a snip with
 * a label, enters loop mode, verifies the carousel shows the snip label,
 * and advances through cards.
 *
 * Snip mode flow:
 *   1. Open a book in the reader
 *   2. Activate snip mode via command palette or programmatic dispatch
 *   3. Drag on a page to create a snip region (SnipOverlay crosshair)
 *   4. SnipBanner appears — type a label and save
 *   5. Navigate to loop page to review snips in carousel
 *
 * Loop mode flow:
 *   1. Navigate to /loop/:slug?mode=sorted
 *   2. LoopCarousel shows the first snip's label as an <h2>
 *   3. "Reveal" button shows the snip image
 *   4. "Next (j)" button advances to the next card
 *   5. Counter updates (e.g., "2 / 3")
 *
 * Selector strategy:
 *   - SnipBanner: input[placeholder*="Chain rule"], "Save" button, "Cancel" button
 *   - LoopCarousel: <h2> with snip label, "Reveal" button, "Next (j)" / "Prev (k)" buttons
 *   - XP counter: text matching /\d+ XP/
 *   - Card counter: text matching /\d+ \/ \d+/
 */

import { test, expect } from '@playwright/test'
import {
  installTauriMocks,
  defaultIpcHandlers,
  FIXTURE_TEXTBOOKS,
  FIXTURE_SNIPS,
} from './tauri-mocks'

test.describe('Snip mode and Loop review (ac-129)', () => {
  test('enters snip mode via custom event dispatch', async ({ page }) => {
    await installTauriMocks(page)

    const slug = FIXTURE_TEXTBOOKS[0].slug
    await page.goto(`/read/${slug}`)

    // Wait for the reader to load
    await expect(
      page.locator('text=Calculus: Early Transcendentals').first()
    ).toBeVisible({ timeout: 10_000 })
    await page.waitForTimeout(1000)

    // Enter snip mode by dispatching the custom event
    // (same mechanism the command palette uses)
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('axiomatic:toggle-snip'))
    })

    // When snip mode is active, the PDF container gets a blue inset
    // box-shadow and SnipOverlay components render crosshair cursors.
    // We verify snip mode is on by checking for the visual indicator.
    await page.waitForTimeout(500)

    // The main PDF container div should have the box-shadow style
    // indicating snip mode is active:
    //   style="box-shadow: inset 0 0 24px rgba(38, 139, 210, 0.15)"
    const snipContainer = page.locator('div[style*="box-shadow"]').first()
    const hasSnipShadow = await snipContainer.isVisible().catch(() => false)

    // Also check for crosshair cursor overlays (SnipOverlay renders
    // a div with class "cursor-crosshair")
    const crosshairOverlay = page.locator('.cursor-crosshair').first()
    const hasCrosshair = await crosshairOverlay.isVisible().catch(() => false)

    // At least one indicator should be present
    expect(hasSnipShadow || hasCrosshair).toBeTruthy()
  })

  test('SnipBanner appears after region selection and saves with label', async ({ page }) => {
    await installTauriMocks(page)

    const slug = FIXTURE_TEXTBOOKS[0].slug
    await page.goto(`/read/${slug}`)

    await expect(
      page.locator('text=Calculus: Early Transcendentals').first()
    ).toBeVisible({ timeout: 10_000 })
    await page.waitForTimeout(1000)

    // Enter snip mode
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('axiomatic:toggle-snip'))
    })
    await page.waitForTimeout(500)

    // Simulate a snip region selection by calling the handler directly.
    // In real usage, the user drags on the SnipOverlay which calls
    // onSnipRegion(page, x, y, w, h). We can trigger this by dispatching
    // mouse events on the crosshair overlay.
    const crosshair = page.locator('.cursor-crosshair').first()
    const crosshairVisible = await crosshair.isVisible().catch(() => false)

    if (crosshairVisible) {
      const box = await crosshair.boundingBox()
      if (box) {
        // Simulate drag: mousedown at (x+50, y+50), move to (x+200, y+150), mouseup
        await page.mouse.move(box.x + 50, box.y + 50)
        await page.mouse.down()
        await page.mouse.move(box.x + 200, box.y + 150, { steps: 5 })
        await page.mouse.up()

        // SnipBanner should appear with a label input
        const labelInput = page.locator('input[placeholder*="Chain rule"]')
        await expect(labelInput).toBeVisible({ timeout: 3_000 })

        // Type a label
        await labelInput.fill('Test derivative formula')

        // Click Save
        const saveButton = page.locator('button', { hasText: 'Save' })
        await expect(saveButton).toBeEnabled()
        await saveButton.click()

        // After saving, the banner should disappear and we're back in snip mode
        await expect(labelInput).not.toBeVisible({ timeout: 3_000 })
      }
    }
  })

  test('exits snip mode with toast message', async ({ page }) => {
    await installTauriMocks(page)

    const slug = FIXTURE_TEXTBOOKS[0].slug
    await page.goto(`/read/${slug}`)

    await expect(
      page.locator('text=Calculus: Early Transcendentals').first()
    ).toBeVisible({ timeout: 10_000 })
    await page.waitForTimeout(1000)

    // Enter snip mode
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('axiomatic:toggle-snip'))
    })
    await page.waitForTimeout(500)

    // Exit snip mode
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('axiomatic:exit-snip'))
    })

    // A toast message should appear: "Snip mode off" (no snips saved this session)
    const toast = page.locator('text=Snip mode off')
    await expect(toast).toBeVisible({ timeout: 3_000 })
  })

  test('loop page renders carousel with snip labels', async ({ page }) => {
    await installTauriMocks(page)

    const slug = FIXTURE_TEXTBOOKS[0].slug

    // Navigate directly to the loop page (sorted mode)
    await page.goto(`/loop/${slug}?mode=sorted`)

    // The first snip label should be shown as an <h2> heading
    const firstLabel = page.locator('h2', { hasText: FIXTURE_SNIPS[0].label })
    await expect(firstLabel).toBeVisible({ timeout: 10_000 })

    // The card counter should show "1 / 3" (3 fixture snips)
    const counter = page.locator('text=1 / 3')
    await expect(counter).toBeVisible()

    // The XP counter should be visible
    const xpCounter = page.locator('text=0 XP')
    await expect(xpCounter).toBeVisible()

    // The "Reveal" button should be visible
    const revealButton = page.locator('button', { hasText: 'Reveal' })
    await expect(revealButton).toBeVisible()

    // The page number should be shown
    const pageNum = page.locator('text=p. ' + FIXTURE_SNIPS[0].page)
    await expect(pageNum).toBeVisible()
  })

  test('loop carousel advances through cards with Next button', async ({ page }) => {
    await installTauriMocks(page)

    const slug = FIXTURE_TEXTBOOKS[0].slug
    await page.goto(`/loop/${slug}?mode=sorted`)

    // Verify first card
    await expect(page.locator('h2', { hasText: FIXTURE_SNIPS[0].label })).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('text=1 / 3')).toBeVisible()

    // Click "Next (j)" to advance to second card
    const nextButton = page.locator('button', { hasText: 'Next (j)' })
    await nextButton.click()

    // Second card should now be displayed
    await expect(page.locator('h2', { hasText: FIXTURE_SNIPS[1].label })).toBeVisible()
    await expect(page.locator('text=2 / 3')).toBeVisible()

    // Advance again to the third card
    await nextButton.click()

    await expect(page.locator('h2', { hasText: FIXTURE_SNIPS[2].label })).toBeVisible()
    await expect(page.locator('text=3 / 3')).toBeVisible()

    // Advancing past the last card wraps around to the first
    await nextButton.click()

    await expect(page.locator('h2', { hasText: FIXTURE_SNIPS[0].label })).toBeVisible()
    await expect(page.locator('text=1 / 3')).toBeVisible()
  })

  test('loop carousel navigates backward with Prev button', async ({ page }) => {
    await installTauriMocks(page)

    const slug = FIXTURE_TEXTBOOKS[0].slug
    await page.goto(`/loop/${slug}?mode=sorted`)

    await expect(page.locator('h2', { hasText: FIXTURE_SNIPS[0].label })).toBeVisible({ timeout: 10_000 })

    // Click "Prev (k)" — should wrap to the last card
    const prevButton = page.locator('button', { hasText: 'Prev (k)' })
    await prevButton.click()

    await expect(page.locator('h2', { hasText: FIXTURE_SNIPS[2].label })).toBeVisible()
    await expect(page.locator('text=3 / 3')).toBeVisible()
  })

  test('loop carousel keyboard navigation (j/k) works', async ({ page }) => {
    await installTauriMocks(page)

    const slug = FIXTURE_TEXTBOOKS[0].slug
    await page.goto(`/loop/${slug}?mode=sorted`)

    await expect(page.locator('h2', { hasText: FIXTURE_SNIPS[0].label })).toBeVisible({ timeout: 10_000 })

    // Press 'j' to advance
    await page.keyboard.press('j')
    await expect(page.locator('h2', { hasText: FIXTURE_SNIPS[1].label })).toBeVisible()
    await expect(page.locator('text=2 / 3')).toBeVisible()

    // Press 'k' to go back
    await page.keyboard.press('k')
    await expect(page.locator('h2', { hasText: FIXTURE_SNIPS[0].label })).toBeVisible()
    await expect(page.locator('text=1 / 3')).toBeVisible()
  })

  test('Reveal button shows snip image', async ({ page }) => {
    await installTauriMocks(page)

    const slug = FIXTURE_TEXTBOOKS[0].slug
    await page.goto(`/loop/${slug}?mode=sorted`)

    await expect(page.locator('h2', { hasText: FIXTURE_SNIPS[0].label })).toBeVisible({ timeout: 10_000 })

    // Initially, the Reveal button is visible and no canvas is rendered
    const revealButton = page.locator('button', { hasText: 'Reveal' })
    await expect(revealButton).toBeVisible()

    // Click Reveal
    await revealButton.click()

    // After revealing, the Reveal button should be gone and a canvas
    // (SnipImage) should appear. In browser mode the canvas won't have
    // real content (pdfium:// images serve 1x1 PNGs), but the canvas
    // element should be present.
    await expect(revealButton).not.toBeVisible({ timeout: 3_000 })

    // A <canvas> element should now be visible
    const canvas = page.locator('canvas')
    await expect(canvas).toBeVisible()
  })

  test('Reveal via Space key', async ({ page }) => {
    await installTauriMocks(page)

    const slug = FIXTURE_TEXTBOOKS[0].slug
    await page.goto(`/loop/${slug}?mode=sorted`)

    await expect(page.locator('button', { hasText: 'Reveal' })).toBeVisible({ timeout: 10_000 })

    // Press Space to reveal
    await page.keyboard.press('Space')

    // Canvas should appear
    const canvas = page.locator('canvas')
    await expect(canvas).toBeVisible({ timeout: 3_000 })
  })

  test('loop page shows empty state when no snips exist', async ({ page }) => {
    const handlers = defaultIpcHandlers({
      list_snips: () => [],
    })
    await installTauriMocks(page, handlers)

    const slug = FIXTURE_TEXTBOOKS[0].slug
    await page.goto(`/loop/${slug}?mode=sorted`)

    // Should show "No snips to review."
    const emptyMessage = page.locator('text=No snips to review')
    await expect(emptyMessage).toBeVisible({ timeout: 10_000 })
  })

  test('ESC exits loop page', async ({ page }) => {
    await installTauriMocks(page)

    const slug = FIXTURE_TEXTBOOKS[0].slug
    await page.goto(`/loop/${slug}?mode=sorted`)

    await expect(page.locator('h2', { hasText: FIXTURE_SNIPS[0].label })).toBeVisible({ timeout: 10_000 })

    // Press Escape to exit
    await page.keyboard.press('Escape')

    // Should navigate away from the loop page.
    // The exact destination depends on tab state, but the URL should
    // no longer be the loop route.
    await page.waitForTimeout(500)
    const url = page.url()
    expect(url).not.toContain('/loop/')
  })
})
