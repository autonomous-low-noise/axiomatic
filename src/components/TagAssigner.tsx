import type { Tag } from '../hooks/useTags'
import { Drawer } from './ui/Drawer'
import { TagCheckList } from './TagCheckList'

interface Props {
  slug: string
  title: string
  tags: Tag[]
  bookTags: Tag[]
  onTag: (slug: string, tagId: number) => void
  onUntag: (slug: string, tagId: number) => void
  onClose: () => void
}

export function TagAssigner({ slug, title, tags, bookTags, onTag, onUntag, onClose }: Props) {
  const assignedIds = new Set(bookTags.map((t) => t.id))

  return (
    <Drawer
      onClose={onClose}
      title={
        <>
          <span className="block text-sm font-semibold text-base02 dark:text-base2">Tags</span>
          <span className="block max-w-44 truncate text-xs font-normal text-base1 dark:text-base00">
            {title}
          </span>
        </>
      }
    >
      <TagCheckList
        items={tags}
        getKey={(tag) => tag.id}
        emptyText="No tags created yet."
        getState={(tag) => (assignedIds.has(tag.id) ? 'all' : 'none')}
        onToggle={(tag) =>
          assignedIds.has(tag.id) ? onUntag(slug, tag.id) : onTag(slug, tag.id)
        }
      />
    </Drawer>
  )
}
