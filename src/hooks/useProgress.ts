import { useCallback, useEffect, useRef, useState } from 'react'
import type { BookProgress, ProgressMap } from '../types/progress'
import { loadAllProgress, saveBookProgress } from '../lib/progress'

/**
 * Hook for reading/writing book progress via .axiomatic/progress.json files.
 *
 * @param dirPaths - Array of directory paths to load progress from.
 *                   Pass all attached directory paths for OverviewPage,
 *                   or just the current book's dir_path for ReaderPage.
 */
export function useProgress(dirPaths: string[] = []) {
  const [progress, setProgress] = useState<ProgressMap>({})
  const progressRef = useRef<ProgressMap>({})
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // Keep ref in sync
  useEffect(() => {
    progressRef.current = progress
  }, [progress])

  // Load progress from all directories
  useEffect(() => {
    if (dirPaths.length === 0) return
    let cancelled = false
    loadAllProgress(dirPaths).then((map) => {
      if (!cancelled) {
        setProgress(map)
        progressRef.current = map
      }
    })
    return () => {
      cancelled = true
    }
    // Stringify to avoid re-loading when the array reference changes but contents are the same
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(dirPaths)])

  const update = useCallback(
    (dirPath: string, slug: string, patch: Partial<BookProgress>) => {
      // Optimistic local update
      const existing = progressRef.current[slug] ?? { currentPage: 1, totalPages: 0, lastReadAt: '' }
      const updated: BookProgress = {
        ...existing,
        ...patch,
        lastReadAt: new Date().toISOString(),
      }
      const newMap = { ...progressRef.current, [slug]: updated }
      progressRef.current = newMap
      setProgress(newMap)

      // Debounce the IPC write at 300ms
      const existing_timer = debounceTimers.current.get(slug)
      if (existing_timer) clearTimeout(existing_timer)

      const timer = setTimeout(() => {
        debounceTimers.current.delete(slug)
        saveBookProgress(dirPath, slug, patch, progressRef.current).catch((err) =>
          console.error('Failed to save progress:', err),
        )
      }, 300)
      debounceTimers.current.set(slug, timer)
    },
    [],
  )

  // Flush pending debounced writes on unmount
  useEffect(() => {
    return () => {
      for (const timer of debounceTimers.current.values()) {
        clearTimeout(timer)
      }
    }
  }, [])

  return { progress, update }
}
