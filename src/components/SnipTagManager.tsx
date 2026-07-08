import type { RefObject } from 'react'
import type { SnipTagDef } from '../hooks/useSnipTagDefs'
import { Menu } from './ui/Menu'
import { TagListEditor } from './TagListEditor'

interface Props {
  defs: SnipTagDef[]
  anchorRef: RefObject<HTMLElement | null>
  onCreate: (name: string, color: string) => void
  onDelete: (name: string) => void
  onRename: (oldName: string, newName: string) => void
  onRecolor: (name: string, color: string) => void
  onClose: () => void
}

export function SnipTagManager({ defs, anchorRef, onCreate, onDelete, onRename, onRecolor, onClose }: Props) {
  return (
    <Menu anchorRef={anchorRef} onClose={onClose} className="w-56 p-0">
      <TagListEditor
        items={defs}
        getKey={(def) => def.name}
        emptyText="No snip tags yet"
        onCreate={onCreate}
        onDelete={(def) => onDelete(def.name)}
        onRecolor={(def, color) => onRecolor(def.name, color)}
        onRename={(def, newName) => onRename(def.name, newName)}
      />
    </Menu>
  )
}
