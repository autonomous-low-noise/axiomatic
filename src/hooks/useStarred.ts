import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { StarredSet } from '../lib/starred'
import { loadAllStarred, toggleStarred as toggleStarredIpc } from '../lib/starred'
import type { Textbook } from './useTextbooks'

export type { StarredSet } from '../lib/starred'

export function useStarred(textbooks: Textbook[]) {
  const [starred, setStarred] = useState<StarredSet>({})
  const loadedDirsRef = useRef<string>('')

  // Build a slug -> dirPath lookup from textbooks
  const slugToDirPath = useMemo(() => {
    const map = new Map<string, string>()
    for (const book of textbooks) {
      map.set(book.slug, book.dir_path)
    }
    return map
  }, [textbooks])

  // Deduplicated directory paths
  const dirPaths = useMemo(() => {
    const unique = new Set<string>()
    for (const book of textbooks) {
      unique.add(book.dir_path)
    }
    return Array.from(unique)
  }, [textbooks])

  // Load starred from all directories when dirPaths change
  useEffect(() => {
    const key = dirPaths.slice().sort().join('\n')
    if (key === loadedDirsRef.current && key !== '') return
    loadedDirsRef.current = key

    if (dirPaths.length === 0) {
      setStarred({})
      return
    }

    let cancelled = false
    loadAllStarred(dirPaths).then((result) => {
      if (!cancelled) setStarred(result)
    }).catch((err) => {
      console.error('Failed to load starred:', err)
    })

    return () => { cancelled = true }
  }, [dirPaths])

  const toggle = useCallback(
    async (slug: string) => {
      const dirPath = slugToDirPath.get(slug)
      if (!dirPath) {
        console.error('Cannot toggle starred: no dir_path found for slug', slug)
        return
      }

      // Optimistic update
      setStarred((prev) => {
        const next = { ...prev }
        if (next[slug]) {
          delete next[slug]
        } else {
          next[slug] = true
        }
        return next
      })

      try {
        await toggleStarredIpc(dirPath, slug)
      } catch (err) {
        console.error('Failed to toggle starred:', err)
        // Revert on error by reloading
        try {
          const fresh = await loadAllStarred(
            Array.from(new Set(Array.from(slugToDirPath.values()))),
          )
          setStarred(fresh)
        } catch {
          // ignore secondary error
        }
      }
    },
    [slugToDirPath],
  )

  return { starred, toggle }
}
