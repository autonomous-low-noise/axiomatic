import { useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'

interface NormalizedRect {
  x: number
  y: number
  width: number
  height: number
}

export interface LinkAnnotation {
  rect: NormalizedRect
  link_type:
    | { type: 'internal'; page: number }
    | { type: 'external'; url: string }
}

// Module-level cache survives component remounts (tab switches)
const linkCache = new Map<string, LinkAnnotation[]>()

function cacheKey(path: string, page: number): string {
  return `${path}:${page}`
}

export function usePageLinks(fullPath: string | undefined) {
  const getLinks = useCallback(
    async (page: number): Promise<LinkAnnotation[]> => {
      if (!fullPath) return []
      const key = cacheKey(fullPath, page)
      const cached = linkCache.get(key)
      if (cached) return cached

      try {
        const links = await invoke<LinkAnnotation[]>('get_page_links', {
          path: fullPath,
          page,
        })
        linkCache.set(key, links)
        return links
      } catch {
        return []
      }
    },
    [fullPath],
  )

  return { getLinks }
}
