import { useState, useRef, useEffect } from 'react'
import { TAG_PALETTE } from '../lib/tagPalette'
import { cx } from '../lib/cx'
import { Button } from './ui/Button'
import { Input } from './ui/Input'

interface TagListEditorProps<T extends { name: string; color: string }> {
  items: T[]
  getKey: (item: T) => string | number
  emptyText: string
  onCreate: (name: string, color: string) => void
  onDelete: (item: T) => void
  onRecolor: (item: T, color: string) => void
  /** Enables double-click-to-rename (Enter/blur commits, Escape cancels the edit). */
  onRename?: (item: T, newName: string) => void
}

/**
 * Shared body for the tag-manager popovers (TagManager / SnipTagManager):
 * scrollable tag list with color-swatch picker + delete, and a bottom
 * create-input with Enter-to-create. Rendered inside a <Menu> popover.
 */
export function TagListEditor<T extends { name: string; color: string }>({
  items,
  getKey,
  emptyText,
  onCreate,
  onDelete,
  onRecolor,
  onRename,
}: TagListEditorProps<T>) {
  const [newName, setNewName] = useState('')
  const [editingKey, setEditingKey] = useState<string | number | null>(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleCreate = () => {
    const name = newName.trim()
    if (!name) return
    onCreate(name, TAG_PALETTE[items.length % TAG_PALETTE.length])
    setNewName('')
  }

  const commitRename = (item: T) => {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== item.name) onRename?.(item, trimmed)
    setEditingKey(null)
  }

  return (
    <>
      <div className="max-h-48 overflow-y-auto">
        {items.length === 0 && (
          <p className="px-3 py-2 text-xs text-base1 dark:text-base00">{emptyText}</p>
        )}
        {items.map((item) => (
          <div
            key={getKey(item)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-base01 hover:bg-base2 dark:text-base1 dark:hover:bg-base03/50"
          >
            <label className="relative shrink-0 cursor-pointer">
              <span
                className="block h-3 w-3 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <input
                type="color"
                value={item.color}
                onChange={(e) => onRecolor(item, e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>
            {onRename && editingKey === getKey(item) ? (
              <input
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => commitRename(item)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename(item)
                  if (e.key === 'Escape') setEditingKey(null)
                  if (e.key !== 'Escape') e.stopPropagation()
                }}
                className="min-w-0 flex-1 rounded border border-blue bg-transparent px-1 text-sm outline-none"
              />
            ) : (
              <span
                className={cx('min-w-0 flex-1 truncate', onRename && 'cursor-text')}
                onDoubleClick={
                  onRename
                    ? () => {
                        setEditingKey(getKey(item))
                        setEditValue(item.name)
                      }
                    : undefined
                }
              >
                {item.name}
              </span>
            )}
            <Button
              variant="icon"
              size="sm"
              className="shrink-0 hover:text-red dark:hover:text-red"
              aria-label={`Delete ${item.name}`}
              onClick={() => onDelete(item)}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </Button>
          </div>
        ))}
      </div>
      <div className="border-t border-base2 px-3 py-2 dark:border-base02">
        <Input
          ref={inputRef}
          surface="panel"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCreate()
            if (e.key !== 'Escape') e.stopPropagation()
          }}
          placeholder="New tag…"
          className="w-full"
        />
      </div>
    </>
  )
}
