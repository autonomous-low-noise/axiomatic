import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { Textbook } from './useTextbooks'

export type StarredSet = Record<string, true>

export function useStarred(textbooks: Textbook[]) {
  const [starred, setStarred] = useState<StarredSet>({})
  const loadedDirsRef = useRef('')

  const slugToDirPath = useMemo(() => {
    const map = new Map<string, string>()
    for (const book of textbooks) map.set(book.slug, book.dir_path)
    return map
  }, [textbooks])

  const dirPaths = useMemo(() => [...new Set(textbooks.map((b) => b.dir_path))], [textbooks])

  useEffect(() => {
    const key = dirPaths.slice().sort().join('\n')
    if (key === loadedDirsRef.current && key !== '') return
    loadedDirsRef.current = key

    if (dirPaths.length === 0) {
      setStarred({})
      return
    }

    let cancelled = false
    Promise.all(dirPaths.map((dirPath) => invoke<string[]>('get_starred', { dirPath }))).then(
      (results) => {
        if (cancelled) return
        const set: StarredSet = {}
        for (const slugs of results) for (const slug of slugs) set[slug] = true
        setStarred(set)
      },
    ).catch((err) => console.error('Failed to load starred:', err))

    return () => { cancelled = true }
  }, [dirPaths])

  const toggle = useCallback(
    async (slug: string) => {
      const dirPath = slugToDirPath.get(slug)
      if (!dirPath) return

      // Optimistic update
      setStarred((prev) => {
        const next = { ...prev }
        if (next[slug]) delete next[slug]
        else next[slug] = true
        return next
      })

      try {
        await invoke('toggle_starred', { dirPath, slug })
      } catch {
        // Revert on error
        const dirs = [...new Set(slugToDirPath.values())]
        const results = await Promise.all(dirs.map((d) => invoke<string[]>('get_starred', { dirPath: d })))
        const set: StarredSet = {}
        for (const slugs of results) for (const s of slugs) set[s] = true
        setStarred(set)
      }
    },
    [slugToDirPath],
  )

  return { starred, toggle }
}
