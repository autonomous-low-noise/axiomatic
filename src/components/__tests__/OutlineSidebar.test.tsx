import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor, act } from '@testing-library/react'

vi.mock('@tauri-apps/api/core')

// Mock thumbnail-queue to grant slots immediately
vi.mock('../../lib/thumbnail-queue', () => ({
  acquireSlot: vi.fn(() => Promise.resolve(() => {})),
}))

import { mockInvoke, mockInvokeError, resetMockInvoke, getInvokeCallsFor } from '../../../__mocks__/@tauri-apps/api/core'
import { OutlineSidebar } from '../OutlineSidebar'
import type { DocumentInfo } from '../../hooks/useDocument'

// Mock IntersectionObserver to trigger immediately
class MockIntersectionObserver {
  callback: IntersectionObserverCallback
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
  }
  observe(target: Element) {
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

const makeDocInfo = (pageCount = 3): DocumentInfo => ({
  doc_id: 'test-doc',
  title: 'Test',
  page_count: pageCount,
  pages: Array.from({ length: pageCount }, () => ({ width_pts: 612, height_pts: 792, aspect_ratio: 0.75 })),
})

beforeEach(() => {
  resetMockInvoke()
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
  // jsdom doesn't implement scrollIntoView
  Element.prototype.scrollIntoView = vi.fn()
})

describe('OutlineSidebar memoization', () => {
  it('is wrapped with React.memo', () => {
    expect((OutlineSidebar as any).$$typeof).toBe(Symbol.for('react.memo'))
  })
})

describe('OutlineSidebar PageTile prerender', () => {
  it('shows placeholder while prerendering, then img after resolve', async () => {
    let resolveGate!: () => void
    const gate = new Promise<void>((r) => { resolveGate = r })
    mockInvoke('prerender_pages', () => gate)

    const { container } = render(
      <OutlineSidebar
        docInfo={makeDocInfo(1)}
        fullPath="/home/user/book.pdf"
        currentPage={1}
        onNavigate={() => {}}
      />,
    )

    // No <img> while prerender gate is pending
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

    const { container } = render(
      <OutlineSidebar
        docInfo={makeDocInfo(1)}
        fullPath="/home/user/broken.pdf"
        currentPage={1}
        onNavigate={() => {}}
      />,
    )

    // .catch() handler sets cached=true, so <img> still mounts
    await waitFor(() => {
      expect(container.querySelector('img')).not.toBeNull()
    })
  })

  it('calls prerender_pages with correct args', async () => {
    const { container } = render(
      <OutlineSidebar
        docInfo={makeDocInfo(1)}
        fullPath="/home/user/book.pdf"
        currentPage={1}
        onNavigate={() => {}}
      />,
    )

    await waitFor(() => {
      expect(container.querySelector('img')).not.toBeNull()
    })

    const calls = getInvokeCallsFor('prerender_pages')
    expect(calls.length).toBeGreaterThanOrEqual(1)
    expect(calls[0].args).toEqual({
      path: '/home/user/book.pdf',
      pages: [1],
      width: 120,
      dpr: 1,
    })
  })
})
