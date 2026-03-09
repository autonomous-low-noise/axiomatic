import { useCallback, useSyncExternalStore } from 'react'
import { createLocalStorageStore } from '../lib/createStore'

const STORAGE_KEY = 'axiomatic:section-collapse'

function load(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function save(state: Record<string, boolean>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

const store = createLocalStorageStore<Record<string, boolean>>(STORAGE_KEY, load)

export function useSectionCollapse() {
  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    () => ({} as Record<string, boolean>),
  )

  const isExpanded = useCallback((key: string) => state[key] ?? false, [state])

  const toggle = useCallback((key: string) => {
    const current = load()
    current[key] = !current[key]
    save(current)
    store.emitChange()
  }, [])

  return { isExpanded, toggle }
}
