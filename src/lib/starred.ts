import { invoke } from '@tauri-apps/api/core'

export type StarredSet = Record<string, true>

/**
 * Fetch starred slugs for a single library directory from .axiomatic/starred.json.
 */
export async function getStarred(dirPath: string): Promise<string[]> {
  return invoke<string[]>('get_starred', { dirPath })
}

/**
 * Toggle a slug's starred state in the given directory's .axiomatic/starred.json.
 * Returns the new starred state (true = now starred, false = now unstarred).
 */
export async function toggleStarred(
  dirPath: string,
  slug: string,
): Promise<boolean> {
  return invoke<boolean>('toggle_starred', { dirPath, slug })
}

/**
 * Load starred slugs from all given directories, returning a merged StarredSet.
 */
export async function loadAllStarred(dirPaths: string[]): Promise<StarredSet> {
  const results = await Promise.all(dirPaths.map(getStarred))
  const set: StarredSet = {}
  for (const slugs of results) {
    for (const slug of slugs) {
      set[slug] = true
    }
  }
  return set
}
