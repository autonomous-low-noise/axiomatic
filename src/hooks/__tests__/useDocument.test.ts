import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { mockInvoke, mockInvokeError, resetMockInvoke, getInvokeCallsFor } from '../../../__mocks__/@tauri-apps/api/core'

vi.mock('@tauri-apps/api/core')

import { useDocument, type DocumentInfo } from '../useDocument'

const sampleDoc: DocumentInfo = {
  doc_id: '/test.pdf',
  page_count: 10,
  pages: Array.from({ length: 10 }, () => ({
    width_pts: 612,
    height_pts: 792,
    aspect_ratio: 612 / 792,
  })),
  title: 'Test Document',
}

beforeEach(() => {
  resetMockInvoke()
})

describe('useDocument', () => {
  it('returns loading=true then resolves with docInfo', async () => {
    mockInvoke('open_document', sampleDoc)
    const { result } = renderHook(() => useDocument('/test.pdf'))

    // Initially loading
    expect(result.current.loading).toBe(true)
    expect(result.current.docInfo).toBe(null)

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.docInfo).toEqual(sampleDoc)
    expect(result.current.error).toBeNull()
  })

  it('sets error on IPC failure', async () => {
    mockInvokeError('open_document', 'file not found')
    const { result } = renderHook(() => useDocument('/missing.pdf'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toContain('file not found')
    expect(result.current.docInfo).toBeNull()
  })

  it('returns null docInfo when fullPath is undefined', () => {
    const { result } = renderHook(() => useDocument(undefined))
    expect(result.current.docInfo).toBeNull()
    // No IPC call made
    expect(getInvokeCallsFor('open_document')).toHaveLength(0)
  })

  it('caches docInfo and reuses on subsequent calls', async () => {
    mockInvoke('open_document', sampleDoc)

    // First mount — triggers IPC
    const { result: r1, unmount } = renderHook(() => useDocument('/cached.pdf'))
    await waitFor(() => expect(r1.current.loading).toBe(false))
    expect(getInvokeCallsFor('open_document')).toHaveLength(1)
    unmount()

    // Second mount with same path — should use cache, no new IPC
    const { result: r2 } = renderHook(() => useDocument('/cached.pdf'))
    expect(r2.current.docInfo).toEqual(sampleDoc)
    expect(r2.current.loading).toBe(false)
    // Still only 1 IPC call total
    expect(getInvokeCallsFor('open_document')).toHaveLength(1)
  })
})
