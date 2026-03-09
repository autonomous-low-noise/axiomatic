import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSectionCollapse } from '../useSectionCollapse'

const STORAGE_KEY = 'axiomatic:section-collapse'

function resetState() {
  localStorage.clear()
  window.dispatchEvent(
    new StorageEvent('storage', { key: STORAGE_KEY, newValue: null }),
  )
}

beforeEach(() => {
  resetState()
})

describe('useSectionCollapse', () => {
  it('isExpanded returns false by default', () => {
    const { result } = renderHook(() => useSectionCollapse())
    expect(result.current.isExpanded('starred')).toBe(false)
    expect(result.current.isExpanded('dir-1')).toBe(false)
  })

  it('toggle flips a section to expanded', () => {
    const { result } = renderHook(() => useSectionCollapse())

    act(() => {
      result.current.toggle('starred')
    })

    expect(result.current.isExpanded('starred')).toBe(true)
  })

  it('toggle twice returns to collapsed', () => {
    const { result } = renderHook(() => useSectionCollapse())

    act(() => {
      result.current.toggle('starred')
    })
    act(() => {
      result.current.toggle('starred')
    })

    expect(result.current.isExpanded('starred')).toBe(false)
  })

  it('persists to localStorage', () => {
    const { result } = renderHook(() => useSectionCollapse())

    act(() => {
      result.current.toggle('dir-5')
    })

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored['dir-5']).toBe(true)
  })

  it('loads persisted state on init', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ starred: true, 'dir-2': true }))
    // Dispatch storage event so the module-level store picks up seeded data
    window.dispatchEvent(
      new StorageEvent('storage', { key: STORAGE_KEY }),
    )

    const { result } = renderHook(() => useSectionCollapse())
    expect(result.current.isExpanded('starred')).toBe(true)
    expect(result.current.isExpanded('dir-2')).toBe(true)
    expect(result.current.isExpanded('dir-99')).toBe(false)
  })
})
