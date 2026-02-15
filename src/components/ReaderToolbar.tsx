import { useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ThemeToggle } from './ThemeToggle'

const MIN_ZOOM = 0.25
const MAX_ZOOM = 5
const ZOOM_FACTOR = 1.15

interface Props {
  title: string
  currentPage: number
  totalPages: number
  zoom: number
  onZoomChange: (zoom: number) => void
  outlineOpen: boolean
  onToggleOutline: () => void
  notesOpen: boolean
  onToggleNotes: () => void
  highlightsOpen: boolean
  onToggleHighlights: () => void
  bookmarksOpen: boolean
  onToggleBookmarks: () => void
  searchOpen: boolean
  onToggleSearch: () => void
  searchQuery: string
  onSearchQueryChange: (q: string) => void
  searchCurrentIndex: number
  searchTotalMatches: number
  onSearchNext: () => void
  onSearchPrev: () => void
  savedProgressPage?: number | null
  onBackToProgress?: () => void
}

export function ReaderToolbar({
  title,
  currentPage,
  totalPages,
  zoom,
  onZoomChange,
  outlineOpen,
  onToggleOutline,
  notesOpen,
  onToggleNotes,
  highlightsOpen,
  onToggleHighlights,
  bookmarksOpen,
  onToggleBookmarks,
  searchOpen,
  onToggleSearch,
  searchQuery,
  onSearchQueryChange,
  searchCurrentIndex,
  searchTotalMatches,
  onSearchNext,
  onSearchPrev,
  savedProgressPage,
  onBackToProgress,
}: Props) {
  const canZoomOut = zoom > MIN_ZOOM
  const canZoomIn = zoom < MAX_ZOOM
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus()
    }
  }, [searchOpen])

  const iconBtnClass = 'shrink-0 rounded p-1.5 text-[#657b83] hover:bg-[#eee8d5] dark:text-[#93a1a1] dark:hover:bg-[#073642]'
  const iconBtnActiveClass = 'shrink-0 rounded p-1.5 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'

  return (
    <div className="shrink-0">
      <div className="flex h-10 shrink-0 items-center border-b border-[#eee8d5] bg-[#fdf6e3] px-3 dark:border-[#073642] dark:bg-[#002b36]">
        {/* Left: back, page counter, title */}
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <Link
            to="/"
            className={iconBtnClass}
            aria-label="Back to library"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </Link>
          <span className="shrink-0 whitespace-nowrap text-sm tabular-nums text-[#657b83] dark:text-[#93a1a1]">
            {currentPage} / {totalPages}
          </span>
          <span className="ml-1 min-w-0 max-w-[28rem] truncate text-xs text-[#93a1a1] dark:text-[#657b83]">
            {title}
          </span>
        </div>
        {/* Center: zoom controls */}
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            onClick={() => canZoomOut && onZoomChange(Math.round(Math.max(MIN_ZOOM, zoom / ZOOM_FACTOR) * 100) / 100)}
            disabled={!canZoomOut}
            className="rounded px-1.5 py-0.5 text-sm text-[#586e75] hover:bg-[#eee8d5] disabled:opacity-30 dark:text-[#93a1a1] dark:hover:bg-[#073642]"
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            onClick={() => onZoomChange(1)}
            className="min-w-[3.5rem] rounded px-1 py-0.5 text-center text-sm tabular-nums text-[#586e75] hover:bg-[#eee8d5] dark:text-[#93a1a1] dark:hover:bg-[#073642]"
            aria-label="Reset zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={() => canZoomIn && onZoomChange(Math.round(Math.min(MAX_ZOOM, zoom * ZOOM_FACTOR) * 100) / 100)}
            disabled={!canZoomIn}
            className="rounded px-1.5 py-0.5 text-sm text-[#586e75] hover:bg-[#eee8d5] disabled:opacity-30 dark:text-[#93a1a1] dark:hover:bg-[#073642]"
            aria-label="Zoom in"
          >
            +
          </button>
        </div>
        {/* Right: search + actions */}
        <div className="flex min-w-0 flex-1 items-center justify-end gap-1">
          {savedProgressPage != null && (
            <button
              onClick={onBackToProgress}
              className="shrink-0 rounded px-1.5 py-0.5 text-xs font-medium text-[#268bd2] hover:bg-[#268bd2]/10 dark:text-[#268bd2] dark:hover:bg-blue-900/30"
              aria-label="Back to current page"
            >
              p.{savedProgressPage}
            </button>
          )}
          {searchOpen && (
            <div className="flex shrink items-center gap-1 overflow-hidden">
              <div className="relative flex shrink-0 items-center">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchQueryChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      if (e.shiftKey) onSearchPrev()
                      else onSearchNext()
                    } else if (e.key === 'Escape') {
                      e.preventDefault()
                      onToggleSearch()
                    }
                  }}
                  placeholder="Search…"
                  className="h-7 w-48 rounded border border-[#93a1a1] bg-[#fdf6e3] px-2 text-sm text-[#073642] outline-none focus:border-blue-400 dark:border-[#073642] dark:bg-[#073642] dark:text-[#eee8d5] dark:focus:border-[#268bd2]"
                  autoFocus
                />
              </div>
              <span className="shrink-0 text-xs tabular-nums text-[#657b83] dark:text-[#93a1a1]">
                {searchTotalMatches > 0
                  ? `${searchCurrentIndex + 1}/${searchTotalMatches}`
                  : searchQuery
                    ? '0/0'
                    : ''}
              </span>
              <button
                onClick={onSearchPrev}
                disabled={searchTotalMatches === 0}
                className="shrink-0 rounded px-1 py-0.5 text-sm text-[#586e75] hover:bg-[#eee8d5] disabled:opacity-30 dark:text-[#93a1a1] dark:hover:bg-[#073642]"
                aria-label="Previous match"
              >
                ‹
              </button>
              <button
                onClick={onSearchNext}
                disabled={searchTotalMatches === 0}
                className="shrink-0 rounded px-1 py-0.5 text-sm text-[#586e75] hover:bg-[#eee8d5] disabled:opacity-30 dark:text-[#93a1a1] dark:hover:bg-[#073642]"
                aria-label="Next match"
              >
                ›
              </button>
              <button
                onClick={onToggleSearch}
                className="shrink-0 rounded p-1 text-[#93a1a1] hover:text-[#586e75] dark:hover:text-[#93a1a1]"
                aria-label="Close search"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          )}
          <button
            onClick={onToggleSearch}
            className={searchOpen ? iconBtnActiveClass : iconBtnClass}
            aria-label="Toggle search"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
          <button
            onClick={onToggleOutline}
            className={outlineOpen ? iconBtnActiveClass : iconBtnClass}
            aria-label="Toggle outline"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </button>
          <button
            onClick={onToggleNotes}
            className={notesOpen ? iconBtnActiveClass : iconBtnClass}
            aria-label="Toggle notes"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </button>
          <button
            onClick={onToggleBookmarks}
            className={bookmarksOpen ? iconBtnActiveClass : iconBtnClass}
            aria-label="Toggle bookmarks"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
          </button>
          <button
            onClick={onToggleHighlights}
            className={highlightsOpen ? iconBtnActiveClass : iconBtnClass}
            aria-label="Toggle highlights"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </button>
          <div className="mx-1 h-4 w-px bg-[#eee8d5] dark:bg-[#073642]" />
          <ThemeToggle />
        </div>
      </div>
    </div>
  )
}
