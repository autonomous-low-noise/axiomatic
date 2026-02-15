import { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'

export interface Textbook {
  slug: string
  title: string
  file: string
  dir_id: number
  dir_path: string
  full_path: string
}

// Module-level cache so navigating to ReaderPage doesn't re-scan the filesystem
let cachedTextbooks: Textbook[] | null = null

export function useTextbooks() {
  const [textbooks, setTextbooks] = useState<Textbook[]>(cachedTextbooks ?? [])
  const [loading, setLoading] = useState(cachedTextbooks === null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const books = await invoke<Textbook[]>('list_textbooks')
      cachedTextbooks = books
      setTextbooks(books)
    } catch (err) {
      console.error('Failed to list textbooks:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!cachedTextbooks) refresh()
  }, [refresh])

  return { textbooks, loading, refresh }
}
