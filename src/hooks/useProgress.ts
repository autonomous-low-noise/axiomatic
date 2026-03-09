import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { BookProgress, ProgressMap } from '../types/progress'

export function useProgress(dirPaths: string[] = []) {
  const [progress, setProgress] = useState<ProgressMap>({})
  const [loaded, setLoaded] = useState(dirPaths.length === 0)
  const progressRef = useRef<ProgressMap>({})
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    progressRef.current = progress
  }, [progress])

  // Load progress from all directories
  useEffect(() => {
    if (dirPaths.length === 0) return
    let cancelled = false

    Promise.all(
      dirPaths.map((dirPath) =>
        invoke<ProgressMap>('get_all_progress', { dirPath }).catch(() => ({}) as ProgressMap),
      ),
    ).then((maps) => {
      if (cancelled) return
      const merged: ProgressMap = {}
      for (const map of maps) Object.assign(merged, map)
      setProgress(merged)
      progressRef.current = merged
      setLoaded(true)
    })

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(dirPaths)])

  const update = useCallback(
    (dirPath: string, slug: string, patch: Partial<BookProgress>) => {
      const existing = progressRef.current[slug] ?? { currentPage: 1, totalPages: 0, lastReadAt: '' }
      const updated: BookProgress = { ...existing, ...patch, lastReadAt: new Date().toISOString() }
      const newMap = { ...progressRef.current, [slug]: updated }
      progressRef.current = newMap
      setProgress(newMap)

      // Debounce the IPC write at 300ms
      const prev = debounceTimers.current.get(slug)
      if (prev) clearTimeout(prev)

      debounceTimers.current.set(
        slug,
        setTimeout(() => {
          debounceTimers.current.delete(slug)
          invoke('save_progress', { dirPath, slug, progress: { ...progressRef.current[slug] } }).catch((err) =>
            console.error('Failed to save progress:', err),
          )
        }, 300),
      )
    },
    [],
  )

  // Flush pending debounced writes on unmount
  useEffect(() => {
    return () => {
      for (const timer of debounceTimers.current.values()) clearTimeout(timer)
    }
  }, [])

  return { progress, update, loaded }
}
