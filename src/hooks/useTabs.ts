import { useCallback, useSyncExternalStore } from 'react'
import { createLocalStorageStore } from '../lib/createStore'

export interface OpenTab {
  slug: string
  title: string
  fullPath: string
}

interface TabsState {
  tabs: OpenTab[]
  activeSlug: string | null
}

const STORAGE_KEY = 'axiomatic:tabs'

function loadTabs(): TabsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as TabsState) : { tabs: [], activeSlug: null }
  } catch {
    return { tabs: [], activeSlug: null }
  }
}

function saveTabs(state: TabsState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

const store = createLocalStorageStore<TabsState>(STORAGE_KEY, loadTabs)
const closedTabsStack: OpenTab[] = []

export function useTabs() {
  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    () => ({ tabs: [], activeSlug: null } as TabsState),
  )

  const openTab = useCallback((tab: OpenTab) => {
    const current = loadTabs()
    const exists = current.tabs.some((t) => t.slug === tab.slug)
    if (!exists) {
      current.tabs.push(tab)
    }
    current.activeSlug = tab.slug
    saveTabs(current)
    store.emitChange()
  }, [])

  const closeTab = useCallback((slug: string): string | null => {
    const current = loadTabs()
    const idx = current.tabs.findIndex((t) => t.slug === slug)
    if (idx === -1) return current.activeSlug

    closedTabsStack.push(current.tabs[idx])
    current.tabs.splice(idx, 1)

    if (current.activeSlug === slug) {
      // Activate adjacent tab
      if (current.tabs.length > 0) {
        current.activeSlug = current.tabs[Math.min(idx, current.tabs.length - 1)].slug
      } else {
        current.activeSlug = null
      }
    }

    saveTabs(current)
    store.emitChange()
    return current.activeSlug
  }, [])

  const reopenTab = useCallback((): string | null => {
    const tab = closedTabsStack.pop()
    if (!tab) return null
    const current = loadTabs()
    if (!current.tabs.some((t) => t.slug === tab.slug)) {
      current.tabs.push(tab)
    }
    current.activeSlug = tab.slug
    saveTabs(current)
    store.emitChange()
    return tab.slug
  }, [])

  const setActiveTab = useCallback((slug: string) => {
    const current = loadTabs()
    if (current.tabs.some((t) => t.slug === slug)) {
      current.activeSlug = slug
      saveTabs(current)
      store.emitChange()
    }
  }, [])

  return {
    tabs: state.tabs,
    activeSlug: state.activeSlug,
    openTab,
    closeTab,
    reopenTab,
    setActiveTab,
  }
}
