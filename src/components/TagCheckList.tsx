export type TagCheckState = 'all' | 'some' | 'none'

interface TagCheckListProps<T extends { name: string; color: string }> {
  items: T[]
  getKey: (item: T) => string | number
  emptyText: string
  /** 'all' → checked, 'some' → indeterminate, 'none' → unchecked. */
  getState: (item: T) => TagCheckState
  onToggle: (item: T) => void
}

/**
 * Shared checkbox-row list for the tag-assigner drawers
 * (TagAssigner / SnipTagAssigner): one row per tag with a native
 * checkbox, color dot, and truncated name.
 */
export function TagCheckList<T extends { name: string; color: string }>({
  items,
  getKey,
  emptyText,
  getState,
  onToggle,
}: TagCheckListProps<T>) {
  return (
    <div className="px-2 py-2">
      {items.length === 0 && (
        <p className="px-2 pt-4 text-center text-xs text-base1 dark:text-base00">
          {emptyText}
        </p>
      )}
      {items.map((item) => {
        const state = getState(item)
        return (
          <label
            key={getKey(item)}
            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-base2 dark:hover:bg-base02/50"
          >
            <input
              type="checkbox"
              checked={state === 'all'}
              ref={(el) => {
                if (el) el.indeterminate = state === 'some'
              }}
              onChange={() => onToggle(item)}
              className="accent-blue"
            />
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="min-w-0 flex-1 truncate text-sm text-base01 dark:text-base1">
              {item.name}
            </span>
          </label>
        )
      })}
    </div>
  )
}
