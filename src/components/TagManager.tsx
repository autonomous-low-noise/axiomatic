import type { RefObject } from 'react'
import type { Tag } from '../hooks/useTags'
import { Menu } from './ui/Menu'
import { TagListEditor } from './TagListEditor'

interface Props {
  tags: Tag[]
  anchorRef: RefObject<HTMLElement | null>
  onCreate: (name: string, color: string) => void
  onDelete: (id: number) => void
  onUpdateColor: (id: number, color: string) => void
  onClose: () => void
}

export function TagManager({ tags, anchorRef, onCreate, onDelete, onUpdateColor, onClose }: Props) {
  return (
    <Menu anchorRef={anchorRef} onClose={onClose} className="w-56 p-0">
      <TagListEditor
        items={tags}
        getKey={(tag) => tag.id}
        emptyText="No tags yet"
        onCreate={onCreate}
        onDelete={(tag) => onDelete(tag.id)}
        onRecolor={(tag, color) => onUpdateColor(tag.id, color)}
      />
    </Menu>
  )
}
