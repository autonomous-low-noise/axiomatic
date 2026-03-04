import { useCallback, useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { Directory } from './useDirectories'

export interface Snip {
  id: string
  slug: string
  full_path: string
  page: number
  label: string
  x: number
  y: number
  width: number
  height: number
  created_at: string
  tags: string[]
}

export function useSnips(slug: string | undefined, dirPath: string | undefined) {
  const [snips, setSnips] = useState<Snip[]>([])
  const [xp, setXp] = useState(0)

  useEffect(() => {
    if (!slug || !dirPath) return
    let cancelled = false
    invoke<Snip[]>('list_snips', { dirPath, slug })
      .then((result) => {
        if (!cancelled) {
          setSnips(result)
        }
      })
      .catch((err) => console.error('list_snips failed:', err))

    invoke<number>('get_xp', { dirPath, slug })
      .then((val) => {
        if (!cancelled) setXp(val)
      })
      .catch((err) => console.error('get_xp failed:', err))

    return () => {
      cancelled = true
    }
  }, [slug, dirPath])

  const addSnip = useCallback(
    async (
      fullPath: string,
      page: number,
      label: string,
      x: number,
      y: number,
      width: number,
      height: number,
    ) => {
      if (!slug || !dirPath) return
      const snip = await invoke<Snip>('create_snip', {
        dirPath,
        slug,
        fullPath,
        page,
        label,
        x,
        y,
        width,
        height,
      })
      setSnips((prev) => [...prev, snip])
      return snip
    },
    [slug, dirPath],
  )

  const removeSnip = useCallback(async (id: string) => {
    if (!dirPath) return
    await invoke('delete_snip', { dirPath, id })
    setSnips((prev) => prev.filter((s) => s.id !== id))
  }, [dirPath])

  const incrementXp = useCallback(async () => {
    if (!slug || !dirPath) return 0
    try {
      const newVal = await invoke<number>('increment_xp', { dirPath, slug })
      setXp(newVal)
      return newVal
    } catch (err) {
      console.error('increment_xp failed:', err)
      return xp
    }
  }, [slug, dirPath, xp])

  return { snips, xp, addSnip, removeSnip, incrementXp }
}

/** Snip enriched with its source directory path for IPC calls. */
export interface SnipWithDir extends Snip {
  dirPath: string
  dirLabel: string
}

/**
 * Load all snips across all attached library directories.
 * Calls `list_all_snips` for each directory and merges the results.
 */
export function useAllSnips(directories: Directory[]) {
  const [snips, setSnips] = useState<SnipWithDir[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const results = await Promise.all(
        directories.map(async (dir) => {
          const dirSnips = await invoke<Snip[]>('list_all_snips', { dirPath: dir.path })
          return dirSnips.map((s) => ({ ...s, dirPath: dir.path, dirLabel: dir.label }))
        }),
      )
      setSnips(results.flat())
    } catch (err) {
      console.error('useAllSnips failed:', err)
    } finally {
      setLoading(false)
    }
  }, [directories])

  useEffect(() => {
    if (directories.length === 0) {
      setSnips([])
      setLoading(false)
      return
    }
    refresh()
  }, [directories, refresh])

  const addTag = useCallback(async (dirPath: string, snipId: string, tag: string) => {
    await invoke('add_snip_tag', { dirPath, snipId, tag })
    setSnips((prev) =>
      prev.map((s) =>
        s.id === snipId ? { ...s, tags: s.tags.includes(tag) ? s.tags : [...s.tags, tag] } : s,
      ),
    )
  }, [])

  const removeTag = useCallback(async (dirPath: string, snipId: string, tag: string) => {
    await invoke('remove_snip_tag', { dirPath, snipId, tag })
    setSnips((prev) =>
      prev.map((s) =>
        s.id === snipId ? { ...s, tags: s.tags.filter((t) => t !== tag) } : s,
      ),
    )
  }, [])

  return { snips, loading, refresh, addTag, removeTag }
}
