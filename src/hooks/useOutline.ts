import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

export interface OutlineEntry {
  title: string
  page: number | null
  children: OutlineEntry[]
}

export function useOutline(fullPath: string | undefined) {
  const [outline, setOutline] = useState<OutlineEntry[]>([])

  useEffect(() => {
    if (!fullPath) return
    let cancelled = false

    invoke<OutlineEntry[]>('get_outline', { path: fullPath })
      .then((entries) => {
        if (!cancelled) setOutline(entries)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [fullPath])

  return outline
}
