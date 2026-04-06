import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import type { OpenTab } from '../useTabs'
import { useTabs } from '../useTabs'

const STORAGE_KEY = 'axiomatic:tabs'

function makeTab(slug: string): OpenTab {
  return {
    slug,
    title: `Title ${slug}`,
    fullPath: `/dir/${slug}.pdf`,
    route: `/read/${slug}`,
  }
}

/**
 * Clear localStorage and force the module-level store to re-read by
 * dispatching a synthetic 'storage' event. This is needed because
 * createLocalStorageStore only refreshes on storage events or explicit
 * emitChange() calls.
 */
function resetTabsState() {
  localStorage.clear()
  // Dispatch a storage event so the module-level store picks up the cleared state
  window.dispatchEvent(
    new StorageEvent('storage', { key: STORAGE_KEY, newValue: null }),
  )
}

beforeEach(() => {
  resetTabsState()
})

describe('useTabs', () => {
  it('starts with empty tabs and null activeSlug', () => {
    const { result } = renderHook(() => useTabs())
    expect(result.current.tabs).toEqual([])
    expect(result.current.activeSlug).toBeNull()
  })

  it('openTab adds a tab and sets it as active', () => {
    const { result } = renderHook(() => useTabs())
    const tab = makeTab('book_a')

    act(() => {
      result.current.openTab(tab)
    })

    expect(result.current.tabs.length).toBe(1)
    expect(result.current.tabs[0].slug).toBe('book_a')
    expect(result.current.activeSlug).toBe('book_a')

    // Verify localStorage persistence
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored.tabs.length).toBe(1)
    expect(stored.activeSlug).toBe('book_a')
  })

  it('openTab does not duplicate an already-open tab', () => {
    const { result } = renderHook(() => useTabs())
    const tab = makeTab('book_a')

    act(() => {
      result.current.openTab(tab)
    })
    act(() => {
      result.current.openTab(tab)
    })

    expect(result.current.tabs.length).toBe(1)
    expect(result.current.activeSlug).toBe('book_a')
  })

  it('closeTab removes the tab and activates an adjacent tab', () => {
    const { result } = renderHook(() => useTabs())

    act(() => {
      result.current.openTab(makeTab('book_a'))
    })
    act(() => {
      result.current.openTab(makeTab('book_b'))
    })
    act(() => {
      result.current.openTab(makeTab('book_c'))
    })

    // Active is book_c (last opened). Close it.
    act(() => {
      result.current.closeTab('book_c')
    })

    expect(result.current.tabs.length).toBe(2)
    expect(result.current.tabs.map((t) => t.slug)).toEqual(['book_a', 'book_b'])
    // Should activate adjacent tab (book_b, since book_c was the last)
    expect(result.current.activeSlug).toBe('book_b')
  })

  it('closeTab sets activeSlug to null when last tab is closed', () => {
    const { result } = renderHook(() => useTabs())

    act(() => {
      result.current.openTab(makeTab('only_book'))
    })
    act(() => {
      result.current.closeTab('only_book')
    })

    expect(result.current.tabs.length).toBe(0)
    expect(result.current.activeSlug).toBeNull()
  })

  it('reopenTab restores the last closed tab', () => {
    const { result } = renderHook(() => useTabs())

    act(() => {
      result.current.openTab(makeTab('book_a'))
    })
    act(() => {
      result.current.openTab(makeTab('book_b'))
    })

    // Close book_b
    act(() => {
      result.current.closeTab('book_b')
    })

    expect(result.current.tabs.length).toBe(1)

    // Reopen
    let reopened: OpenTab | null = null
    act(() => {
      reopened = result.current.reopenTab()
    })

    expect(reopened).not.toBeNull()
    expect(reopened!.slug).toBe('book_b')
    expect(result.current.tabs.length).toBe(2)
    expect(result.current.activeSlug).toBe('book_b')
  })

  it('reopenTab returns null when reopen stack is exhausted', () => {
    const { result } = renderHook(() => useTabs())

    // Drain any entries remaining on the module-level closedTabsStack
    // from previous tests by calling reopenTab until null
    let drained: OpenTab | null = { slug: '', title: '', fullPath: '', route: '' }
    while (drained !== null) {
      act(() => {
        drained = result.current.reopenTab()
      })
    }

    // Now the stack is truly empty; reopenTab should return null
    let reopened: OpenTab | null = null
    act(() => {
      reopened = result.current.reopenTab()
    })

    expect(reopened).toBeNull()
  })

  it('preserves tab order when opening multiple tabs', () => {
    const { result } = renderHook(() => useTabs())

    act(() => {
      result.current.openTab(makeTab('book_a'))
    })
    act(() => {
      result.current.openTab(makeTab('book_b'))
    })
    act(() => {
      result.current.openTab(makeTab('book_c'))
    })

    expect(result.current.tabs.map((t) => t.slug)).toEqual(['book_a', 'book_b', 'book_c'])
  })

  it('setActiveTab switches active without modifying tab list', () => {
    const { result } = renderHook(() => useTabs())

    act(() => {
      result.current.openTab(makeTab('book_a'))
    })
    act(() => {
      result.current.openTab(makeTab('book_b'))
    })

    expect(result.current.activeSlug).toBe('book_b')

    act(() => {
      result.current.setActiveTab('book_a')
    })

    expect(result.current.activeSlug).toBe('book_a')
    expect(result.current.tabs.length).toBe(2)
  })

  it('closeOtherTabs keeps only the specified tab', () => {
    const { result } = renderHook(() => useTabs())

    act(() => {
      result.current.openTab(makeTab('book_a'))
    })
    act(() => {
      result.current.openTab(makeTab('book_b'))
    })
    act(() => {
      result.current.openTab(makeTab('book_c'))
    })

    act(() => {
      result.current.closeOtherTabs('book_b')
    })

    expect(result.current.tabs.length).toBe(1)
    expect(result.current.tabs[0].slug).toBe('book_b')
    expect(result.current.activeSlug).toBe('book_b')
  })

  it('closeTabsToLeft removes tabs before the specified tab', () => {
    const { result } = renderHook(() => useTabs())

    act(() => { result.current.openTab(makeTab('book_a')) })
    act(() => { result.current.openTab(makeTab('book_b')) })
    act(() => { result.current.openTab(makeTab('book_c')) })

    act(() => { result.current.closeTabsToLeft('book_c') })

    expect(result.current.tabs.map((t) => t.slug)).toEqual(['book_c'])
    expect(result.current.activeSlug).toBe('book_c')
  })

  it('closeTabsToLeft is a no-op for the first tab', () => {
    const { result } = renderHook(() => useTabs())

    act(() => { result.current.openTab(makeTab('book_a')) })
    act(() => { result.current.openTab(makeTab('book_b')) })

    act(() => { result.current.closeTabsToLeft('book_a') })

    expect(result.current.tabs.map((t) => t.slug)).toEqual(['book_a', 'book_b'])
  })

  it('closeTabsToRight removes tabs after the specified tab', () => {
    const { result } = renderHook(() => useTabs())

    act(() => { result.current.openTab(makeTab('book_a')) })
    act(() => { result.current.openTab(makeTab('book_b')) })
    act(() => { result.current.openTab(makeTab('book_c')) })

    act(() => { result.current.closeTabsToRight('book_a') })

    expect(result.current.tabs.map((t) => t.slug)).toEqual(['book_a'])
    expect(result.current.activeSlug).toBe('book_a')
  })

  it('closeTabsToRight is a no-op for the last tab', () => {
    const { result } = renderHook(() => useTabs())

    act(() => { result.current.openTab(makeTab('book_a')) })
    act(() => { result.current.openTab(makeTab('book_b')) })

    act(() => { result.current.closeTabsToRight('book_b') })

    expect(result.current.tabs.map((t) => t.slug)).toEqual(['book_a', 'book_b'])
  })
})
