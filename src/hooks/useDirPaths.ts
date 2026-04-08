import { useMemo } from 'react'
import type { Directory } from './useDirectories'

/** Extract dir paths from directories array — avoids duplicating this useMemo across pages. */
export function useDirPaths(directories: Directory[]): string[] {
  return useMemo(() => directories.map((d) => d.path), [directories])
}
