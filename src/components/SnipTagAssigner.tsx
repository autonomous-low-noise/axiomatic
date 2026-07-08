import { useMemo } from 'react'
import type { SnipTagDef } from '../hooks/useSnipTagDefs'
import type { SnipWithDir } from '../hooks/useSnips'
import { Drawer } from './ui/Drawer'
import { TagCheckList, type TagCheckState } from './TagCheckList'

interface Props {
  defs: SnipTagDef[]
  selectedSnips: SnipWithDir[]
  onBulkAdd: (dirPath: string, snipIds: string[], tag: string) => void
  onBulkRemove: (dirPath: string, snipIds: string[], tag: string) => void
  onClose: () => void
}

export function SnipTagAssigner({ defs, selectedSnips, onBulkAdd, onBulkRemove, onClose }: Props) {
  // For each tag, compute assignment state across selected snips
  const tagStates = useMemo(() => {
    const map = new Map<string, TagCheckState>()
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
    <Drawer
      onClose={onClose}
      title={
        <>
          <span className="block text-sm font-semibold text-base02 dark:text-base2">
            Assign Tags
          </span>
          <span className="block max-w-44 truncate text-xs font-normal text-base1 dark:text-base00">
            {selectedSnips.length} snip{selectedSnips.length !== 1 ? 's' : ''} selected
          </span>
        </>
      }
    >
      <TagCheckList
        items={defs}
        getKey={(def) => def.name}
        emptyText="No snip tags created yet."
        getState={(def) => tagStates.get(def.name) ?? 'none'}
        onToggle={(def) => handleToggle(def.name)}
      />
    </Drawer>
  )
}
