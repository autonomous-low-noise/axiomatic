import { useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'

interface NormalizedRect {
  x: number
  y: number
  width: number
  height: number
}

export interface TextSpan {
  text: string
  rect: NormalizedRect
  char_rects: NormalizedRect[]
}

export interface PageTextLayer {
  page: number
  spans: TextSpan[]
}

// Module-level cache survives component remounts (tab switches)
const textLayerCache = new Map<string, PageTextLayer>()

function cacheKey(path: string, page: number): string {
  return `${path}:${page}`
}

export function usePageTextLayer(fullPath: string | undefined) {
  const getTextLayer = useCallback(
    async (page: number): Promise<PageTextLayer | null> => {
      if (!fullPath) return null
      const key = cacheKey(fullPath, page)
      const cached = textLayerCache.get(key)
      if (cached) return cached

      try {
        const layer = await invoke<PageTextLayer>('get_page_text_layer', {
          path: fullPath,
          page,
        })
        textLayerCache.set(key, layer)
        return layer
      } catch {
        return null
      }
    },
    [fullPath],
  )

  const getCachedTextLayer = useCallback(
    (page: number): PageTextLayer | undefined => {
      if (!fullPath) return undefined
      return textLayerCache.get(cacheKey(fullPath, page))
    },
    [fullPath],
  )

  return { getTextLayer, getCachedTextLayer }
}
