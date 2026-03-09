import { useEffect, useRef, useMemo } from 'react'
import type { SnipTagDef } from '../hooks/useSnipTagDefs'
import type { SnipWithDir } from '../hooks/useSnips'

interface Props {
  defs: SnipTagDef[]
  selectedSnips: SnipWithDir[]
  onBulkAdd: (dirPath: string, snipIds: string[], tag: string) => void
  onBulkRemove: (dirPath: string, snipIds: string[], tag: string) => void
  onClose: () => void
}

export function SnipTagAssigner({ defs, selectedSnips, onBulkAdd, onBulkRemove, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  // For each tag, compute assignment state across selected snips
  const tagStates = useMemo(() => {
    const map = new Map<string, 'all' | 'some' | 'none'>()
    for (const def of defs) {
      let count = 0
      for (const snip of selectedSnips) {
        if (snip.tags.includes(def.name)) count++
      }
      if (count === 0) map.set(def.name, 'none')
      else if (count === selectedSnips.length) map.set(def.name, 'all')
      else map.set(def.name, 'some')
    }
    return map
  }, [defs, selectedSnips])

  const handleToggle = (tagName: string) => {
    const state = tagStates.get(tagName)
    // Group snips by dirPath for IPC calls
    const byDir = new Map<string, string[]>()
    for (const snip of selectedSnips) {
      const ids = byDir.get(snip.dirPath) ?? []
      ids.push(snip.id)
      byDir.set(snip.dirPath, ids)
    }

    if (state === 'all') {
      // Remove from all
      for (const [dirPath, ids] of byDir) {
        onBulkRemove(dirPath, ids, tagName)
      }
    } else {
      // Add to all (handles 'none' and 'some')
      for (const [dirPath, ids] of byDir) {
        onBulkAdd(dirPath, ids, tagName)
      }
    }
  }

  return (
    <div
      ref={ref}
      className="absolute inset-y-0 right-0 z-30 flex w-64 flex-col border-l border-[#eee8d5] bg-[#fdf6e3] shadow-lg dark:border-[#073642] dark:bg-[#002b36]"
    >
      <div className="flex items-center justify-between border-b border-[#eee8d5] px-4 py-3 dark:border-[#073642]">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-[#073642] dark:text-[#eee8d5]">Assign Tags</h2>
          <p className="truncate text-xs text-[#93a1a1] dark:text-[#657b83]">
            {selectedSnips.length} snip{selectedSnips.length !== 1 ? 's' : ''} selected
          </p>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 rounded p-1 text-[#657b83] hover:bg-[#eee8d5] dark:text-[#93a1a1] dark:hover:bg-[#073642]"
          aria-label="Close tag assigner"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {defs.length === 0 && (
          <p className="px-2 pt-4 text-center text-xs text-[#93a1a1] dark:text-[#657b83]">
            No snip tags created yet.
          </p>
        )}
        {defs.map((def) => {
          const state = tagStates.get(def.name) ?? 'none'
          return (
            <label
              key={def.name}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-[#eee8d5] dark:hover:bg-[#073642]/50"
            >
              <input
                type="checkbox"
                checked={state === 'all'}
                ref={(el) => {
                  if (el) el.indeterminate = state === 'some'
                }}
                onChange={() => handleToggle(def.name)}
                className="accent-[#268bd2]"
              />
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: def.color }}
              />
              <span className="min-w-0 flex-1 truncate text-sm text-[#586e75] dark:text-[#93a1a1]">
                {def.name}
              </span>
            </label>
          )
        })}
      </div>
    </div>
  )
}
