import { invoke } from '@tauri-apps/api/core'
import type { BookProgress, ProgressMap } from '../types/progress'

export async function loadAllProgress(dirPaths: string[]): Promise<ProgressMap> {
  const maps = await Promise.all(
    dirPaths.map((dirPath) =>
      invoke<ProgressMap>('get_all_progress', { dirPath }).catch(() => ({} as ProgressMap)),
    ),
  )
  const merged: ProgressMap = {}
  for (const map of maps) {
    for (const [slug, progress] of Object.entries(map)) {
      merged[slug] = progress
    }
  }
  return merged
}

export async function saveBookProgress(
  dirPath: string,
  slug: string,
  patch: Partial<BookProgress>,
  currentMap: ProgressMap,
): Promise<BookProgress> {
  const existing = currentMap[slug] ?? { currentPage: 1, totalPages: 0, lastReadAt: '' }
  const updated: BookProgress = {
    ...existing,
    ...patch,
    lastReadAt: new Date().toISOString(),
  }
  await invoke('save_progress', { dirPath, slug, progress: updated })
  return updated
}
