import { useCallback, useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

export interface SearchMatch {
  page: number
  match_index: number
}

export function useSearch(fullPath: string | undefined) {
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState<SearchMatch[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)

  // Search whenever query changes
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- intentional: reset and async fetch with cleanup */
    if (!query.trim() || !fullPath) {
      setMatches([])
      setCurrentIndex(0)
      return
    }

    let cancelled = false

    invoke<SearchMatch[]>('search_document', { path: fullPath, query })
      .then((results) => {
        if (cancelled) return
        setMatches(results)
        setCurrentIndex(0)
      })
      .catch(() => {
        if (!cancelled) {
          setMatches([])
          setCurrentIndex(0)
        }
      })

    return () => {
      cancelled = true
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [query, fullPath])

  const nextMatch = useCallback(() => {
    if (matches.length === 0) return
    setCurrentIndex((i) => (i + 1) % matches.length)
  }, [matches.length])

  const prevMatch = useCallback(() => {
    if (matches.length === 0) return
    setCurrentIndex((i) => (i - 1 + matches.length) % matches.length)
  }, [matches.length])

  const currentMatchPage = matches.length > 0 ? matches[currentIndex]?.page ?? 0 : 0

  return {
    query,
    setQuery,
    totalMatches: matches.length,
    currentIndex,
    currentMatchPage,
    nextMatch,
    prevMatch,
  }
}
