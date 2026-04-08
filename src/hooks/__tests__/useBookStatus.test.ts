import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { mockInvoke, resetMockInvoke } from '../../../__mocks__/@tauri-apps/api/core'

vi.mock('@tauri-apps/api/core')

import { useBookStatus } from '../useBookStatus'

beforeEach(() => {
  resetMockInvoke()
})

describe('useBookStatus', () => {
  it('returns open for unknown slugs', () => {
    const { result } = renderHook(() => useBookStatus([], {}))
    expect(result.current.getStatus('anything')).toBe('open')
  })

  it('loads stored statuses from IPC', async () => {
    mockInvoke('get_all_book_status', { algebra: 'done', topology: 'in-progress' })
    const { result } = renderHook(() => useBookStatus(['/lib'], {}))

    // Wait for effect to settle
    await vi.waitFor(() => {
      expect(result.current.getStatus('algebra')).toBe('done')
    })
    expect(result.current.getStatus('topology')).toBe('in-progress')
    expect(result.current.getStatus('unknown')).toBe('open')
  })

  it('setStatus updates optimistically', async () => {
    mockInvoke('set_book_status', null)
    // Use empty dirPaths to avoid load race; setStatus works regardless
    const { result } = renderHook(() => useBookStatus([]))

    await act(async () => {
      await result.current.setStatus('/lib', 'algebra', 'done')
    })

    expect(result.current.bookStatus['algebra']).toBe('done')
  })

  it('handles empty dirPaths without fetching', () => {
    const { result } = renderHook(() => useBookStatus([], {}))
    expect(result.current.bookStatus).toEqual({})
  })
})
