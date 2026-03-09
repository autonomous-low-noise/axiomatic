import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import { getNote as getNoteSql, setNote as setNoteSql } from '../lib/notes'

type NoteCache = Map<string, string>

let cache: NoteCache = new Map()
let listeners: Array<() => void> = []
let revision = 0

function subscribe(cb: () => void) {
  listeners = [...listeners, cb]
  return () => {
    listeners = listeners.filter((l) => l !== cb)
  }
}

function emitChange() {
  revision += 1
  for (const l of listeners) l()
}

function cacheKey(slug: string, page: number) {
  return `${slug}:${page}`
}

const pendingFetches = new Set<string>()

/**
 * Selective subscription: only re-renders when the specific note changes.
 * Returns `undefined` while loading, `string` when loaded.
 */
export function useNoteContent(slug: string | undefined, page: number): string | undefined {
  const key = slug ? cacheKey(slug, page) : ''
  return useSyncExternalStore(
    subscribe,
    () => (slug ? cache.get(key) : undefined),
    () => undefined,
  )
}

/**
 * Returns stable callbacks for managing notes.
 * Does NOT subscribe to the store — use `useNoteContent` to read.
 */
export function useNotes() {
  const debounceRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    return () => {
      for (const t of debounceRef.current.values()) clearTimeout(t)
    }
  }, [])

  const ensureNote = useCallback(
    (slug: string, page: number): void => {
      const key = cacheKey(slug, page)
      if (cache.has(key) || pendingFetches.has(key)) return
      pendingFetches.add(key)
      getNoteSql(slug, page).then((record) => {
        pendingFetches.delete(key)
        const content = record?.content ?? ''
        cache.set(key, content)
        emitChange()
      })
    },
    [],
  )

  const setNote = useCallback(
    (slug: string, page: number, content: string) => {
      const key = cacheKey(slug, page)
      // Optimistic update
      cache.set(key, content)
      emitChange()

      // Debounced write to SQLite
      const existing = debounceRef.current.get(key)
      if (existing) clearTimeout(existing)
      debounceRef.current.set(
        key,
        setTimeout(() => {
          debounceRef.current.delete(key)
          setNoteSql(slug, page, content, 'markdown')
        }, 150),
      )
    },
    [],
  )

  return { ensureNote, setNote }
}
