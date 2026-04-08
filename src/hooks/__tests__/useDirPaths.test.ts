import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useDirPaths } from '../useDirPaths'

describe('useDirPaths', () => {
  it('extracts paths from directories', () => {
    const dirs = [
      { id: 1, path: '/a', label: 'A', added_at: '' },
      { id: 2, path: '/b', label: 'B', added_at: '' },
    ]
    const { result } = renderHook(() => useDirPaths(dirs))
    expect(result.current).toEqual(['/a', '/b'])
  })

  it('returns empty array for empty directories', () => {
    const { result } = renderHook(() => useDirPaths([]))
    expect(result.current).toEqual([])
  })

  it('returns stable reference for same input', () => {
    const dirs = [{ id: 1, path: '/a', label: 'A', added_at: '' }]
    const { result, rerender } = renderHook(() => useDirPaths(dirs))
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
  })
})
