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

const cache = new Map<string, PageTextLayer>()

export function usePageTextLayer(fullPath: string | undefined) {
  const getTextLayer = useCallback(
    async (page: number): Promise<PageTextLayer | null> => {
      if (!fullPath) return null
      const key = `${fullPath}:${page}`
      const hit = cache.get(key)
      if (hit) return hit
      try {
        const layer = await invoke<PageTextLayer>('get_page_text_layer', { path: fullPath, page })
        cache.set(key, layer)
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
      return cache.get(`${fullPath}:${page}`)
    },
    [fullPath],
  )

  return { getTextLayer, getCachedTextLayer }
}
