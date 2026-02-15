import { useMemo } from 'react'
import type { Highlight } from '../hooks/useHighlights'

interface Props {
  bookmarks: Highlight[]
  width: number
  onNavigate: (page: number) => void
  onDeleteHighlight: (id: number) => void
  onDeleteHighlightGroup: (groupId: string) => void
}

export function BookmarksPanel({
  bookmarks,
  width,
  onNavigate,
  onDeleteHighlight,
  onDeleteHighlightGroup,
}: Props) {
  // Group bookmarks by group_id (multi-rect selections share one entry)
  const entries = useMemo(() => {
    const grouped = new Map<
      string,
      { page: number; text: string; ids: number[]; groupId: string }
    >()
    const singles: { page: number; text: string; id: number }[] = []

    for (const h of bookmarks) {
      if (h.group_id) {
        const existing = grouped.get(h.group_id)
        if (existing) {
          existing.ids.push(h.id)
        } else {
          grouped.set(h.group_id, {
            page: h.page,
            text: h.text,
            ids: [h.id],
            groupId: h.group_id,
          })
        }
      } else {
        singles.push({ page: h.page, text: h.text || h.note, id: h.id })
      }
    }

    const result: {
      key: string
      page: number
      text: string
      groupId?: string
      id?: number
    }[] = []

    for (const [gid, g] of grouped) {
      result.push({ key: gid, page: g.page, text: g.text, groupId: g.groupId })
    }
    for (const s of singles) {
      result.push({ key: `single-${s.id}`, page: s.page, text: s.text, id: s.id })
    }

    result.sort((a, b) => a.page - b.page)
    return result
  }, [bookmarks])

  // Group by page for display
  const pageGroups = useMemo(() => {
    const groups: { page: number; items: typeof entries }[] = []
    let currentPage = -1
    let currentItems: typeof entries = []
    for (const entry of entries) {
      if (entry.page !== currentPage) {
        if (currentItems.length > 0) {
          groups.push({ page: currentPage, items: currentItems })
        }
        currentPage = entry.page
        currentItems = [entry]
      } else {
        currentItems.push(entry)
      }
    }
    if (currentItems.length > 0) {
      groups.push({ page: currentPage, items: currentItems })
    }
    return groups
  }, [entries])

  const handleDelete = (entry: (typeof entries)[0]) => {
    if (entry.groupId) {
      onDeleteHighlightGroup(entry.groupId)
    } else if (entry.id != null) {
      onDeleteHighlight(entry.id)
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden" style={{ width }}>
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-[#eee8d5] bg-[#fdf6e3] px-3 dark:border-[#073642] dark:bg-[#002b36]">
        <span className="text-xs font-medium text-[#586e75] dark:text-[#93a1a1]">
          Bookmarks
        </span>
        <span className="text-xs tabular-nums text-[#93a1a1] dark:text-[#657b83]">
          {entries.length}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto bg-[#fdf6e3] dark:bg-[#002b36]">
        {pageGroups.length === 0 && (
          <p className="p-4 text-center text-xs text-[#93a1a1] dark:text-[#657b83]">
            No bookmarks yet. Select text and right-click to bookmark.
          </p>
        )}
        {pageGroups.map((group) => (
          <div key={group.page}>
            <div className="sticky top-0 border-b border-[#eee8d5] bg-[#fdf6e3]/90 px-3 py-1 backdrop-blur-sm dark:border-[#073642] dark:bg-[#002b36]/90">
              <span className="text-xs font-medium text-[#93a1a1] dark:text-[#657b83]">
                Page {group.page}
              </span>
            </div>
            {group.items.map((entry) => (
              <div
                key={entry.key}
                className="group flex cursor-pointer items-start gap-2 border-b border-[#eee8d5]/50 px-3 py-2 hover:bg-[#eee8d5] dark:border-[#073642]/50 dark:hover:bg-[#073642]"
                onClick={() => onNavigate(entry.page)}
              >
                <svg
                  className="mt-0.5 shrink-0 text-[#93a1a1] dark:text-[#657b83]"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
                <span className="mr-2 line-clamp-3 min-w-0 flex-1 overflow-hidden text-xs leading-relaxed text-[#586e75] dark:text-[#93a1a1]">
                  {entry.text || '(no text)'}
                </span>
                <button
                  className="shrink-0 rounded p-1 text-[#93a1a1] opacity-0 hover:bg-[#eee8d5] hover:text-[#dc322f] group-hover:opacity-100 dark:text-[#657b83] dark:hover:bg-[#073642] dark:hover:text-[#dc322f]"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDelete(entry)
                  }}
                  aria-label="Delete bookmark"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
