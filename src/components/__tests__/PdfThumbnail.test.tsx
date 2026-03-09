import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor, act } from '@testing-library/react'

vi.mock('@tauri-apps/api/core')

// Mock thumbnail-queue to grant slots immediately
vi.mock('../../lib/thumbnail-queue', () => ({
  acquireSlot: vi.fn(() => Promise.resolve(() => {})),
}))

import { mockInvoke, mockInvokeError, resetMockInvoke, getInvokeCallsFor } from '../../../__mocks__/@tauri-apps/api/core'
import { PdfThumbnail } from '../PdfThumbnail'

// Mock IntersectionObserver to trigger immediately
class MockIntersectionObserver {
  callback: IntersectionObserverCallback
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
  }
  observe(target: Element) {
    // Trigger immediately as intersecting
    this.callback(
      [{ isIntersecting: true, target } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    )
  }
  disconnect() {}
  unobserve() {}
  takeRecords() { return [] }
  get root() { return null }
  get rootMargin() { return '' }
  get thresholds() { return [] }
}

beforeEach(() => {
  resetMockInvoke()
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
})

describe('PdfThumbnail', () => {
  it('shows placeholder while prerendering, then img after resolve', async () => {
    let resolveGate!: () => void
    const gate = new Promise<void>((r) => { resolveGate = r })
    mockInvoke('prerender_pages', () => gate)

    const { container } = render(<PdfThumbnail fullPath="/home/user/book.pdf" />)

    // Placeholder (animate-pulse div) should be visible while gate is pending
    // No <img> yet
    expect(container.querySelector('img')).toBeNull()

    // Resolve the prerender gate
    await act(async () => { resolveGate() })

    // <img> should now appear with correct pdfium:// src
    await waitFor(() => {
      const img = container.querySelector('img')
      expect(img).not.toBeNull()
      expect(img!.getAttribute('src')).toContain('pdfium://localhost/render')
      expect(img!.getAttribute('src')).toContain(encodeURIComponent('/home/user/book.pdf'))
    })
  })

  it('shows img even when prerender_pages fails', async () => {
    mockInvokeError('prerender_pages', 'crash')

    const { container } = render(<PdfThumbnail fullPath="/home/user/broken.pdf" />)

    // .catch() handler sets cached=true, so <img> still mounts
    await waitFor(() => {
      expect(container.querySelector('img')).not.toBeNull()
    })
  })

  it('calls prerender_pages with correct args', async () => {
    const { container } = render(<PdfThumbnail fullPath="/home/user/book.pdf" />)

    await waitFor(() => {
      expect(container.querySelector('img')).not.toBeNull()
    })

    const calls = getInvokeCallsFor('prerender_pages')
    expect(calls.length).toBeGreaterThanOrEqual(1)
    expect(calls[0].args).toEqual({
      path: '/home/user/book.pdf',
      pages: [1],
      width: 200,
      dpr: 1,
    })
  })
})
