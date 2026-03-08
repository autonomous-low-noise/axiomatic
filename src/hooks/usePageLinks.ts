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

const cache = new Map<string, LinkAnnotation[]>()

export function usePageLinks(fullPath: string | undefined) {
  const getLinks = useCallback(
    async (page: number): Promise<LinkAnnotation[]> => {
      if (!fullPath) return []
      const key = `${fullPath}:${page}`
      const hit = cache.get(key)
      if (hit) return hit
      try {
        const links = await invoke<LinkAnnotation[]>('get_page_links', { path: fullPath, page })
        cache.set(key, links)
        return links
      } catch {
        return []
      }
    },
    [fullPath],
  )

  return { getLinks }
}
