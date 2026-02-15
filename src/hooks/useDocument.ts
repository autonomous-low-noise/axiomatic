import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'

export interface PageDimension {
  width_pts: number
  height_pts: number
  aspect_ratio: number
}

export interface DocumentInfo {
  doc_id: string
  page_count: number
  pages: PageDimension[]
  title: string | null
}

// Cache DocumentInfo so tab switches are instant
const docCache = new Map<string, DocumentInfo>()

export function useDocument(fullPath: string | undefined) {
  const cached = fullPath ? docCache.get(fullPath) ?? null : null
  const [docInfo, setDocInfo] = useState<DocumentInfo | null>(cached)
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!fullPath) return

    const hit = docCache.get(fullPath)
    if (hit) {
      setDocInfo(hit)
      setLoading(false)
      setError(null)
      // No need to re-open in PDFium — render_page calls ensure_document
      // which reloads on demand if evicted.
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    invoke<DocumentInfo>('open_document', { path: fullPath })
      .then((info) => {
        if (!cancelled) {
          docCache.set(fullPath, info)
          setDocInfo(info)
          setLoading(false)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(String(e))
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [fullPath])

  return { docInfo, loading, error }
}
