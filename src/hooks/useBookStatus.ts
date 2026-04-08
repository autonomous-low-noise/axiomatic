import { useCallback, useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { BookStatus, BookStatusMap, ProgressMap } from '../types/progress'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useBookStatus(dirPaths: string[], _progress?: ProgressMap) {
  const [bookStatus, setBookStatus] = useState<BookStatusMap>({})

  useEffect(() => {
    if (dirPaths.length === 0) return
    let cancelled = false

    Promise.all(
      dirPaths.map((dirPath) =>
        invoke<Record<string, string>>('get_all_book_status', { dirPath }).catch(() => ({})),
      ),
    ).then((maps) => {
      if (cancelled) return
      const merged: BookStatusMap = {}
      for (const map of maps) {
        for (const [slug, status] of Object.entries(map)) {
          merged[slug] = status as BookStatus
        }
      }
      setBookStatus(merged)
    })

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(dirPaths)])

  const getStatus = useCallback((slug: string): BookStatus => {
    return bookStatus[slug] ?? 'open'
  }, [bookStatus])

  const setStatus = useCallback(async (dirPath: string, slug: string, status: BookStatus) => {
    setBookStatus((prev) => ({ ...prev, [slug]: status }))
    await invoke('set_book_status', { dirPath, slug, status })
  }, [])

  return { bookStatus, getStatus, setStatus }
}
