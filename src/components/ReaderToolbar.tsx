import { useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { togglePalette } from '../lib/palette'
import { PomodoroTimer } from './PomodoroTimer'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Badge } from './ui/Badge'

const MIN_ZOOM = 0.25
const MAX_ZOOM = 5
const ZOOM_FACTOR = 1.15

interface Props {
  title: string
  currentPage: number
  totalPages: number
  zoom: number
  onZoomChange: (zoom: number) => void
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
  zenMode?: boolean
  activeSlug?: string
  activeDirPath?: string
  snipMode?: boolean
  onToggleSnipMode?: () => void
  hasSnips?: boolean
  onLoopSorted?: () => void
  onLoopShuffled?: () => void
  learningTools?: boolean
  bookStatus?: import('../types/progress').BookStatus
  onSetBookStatus?: (status: import('../types/progress').BookStatus) => void
}

export function ReaderToolbar({
  title,
  currentPage,
  totalPages,
  zoom,
  onZoomChange,
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
  zenMode,
  activeSlug,
  activeDirPath,
  snipMode,
  onToggleSnipMode,
  hasSnips,
  onLoopSorted,
  onLoopShuffled,
  learningTools = true,
  bookStatus,
  onSetBookStatus,
}: Props) {
  const canZoomOut = zoom > MIN_ZOOM
  const canZoomIn = zoom < MAX_ZOOM
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus()
    }
  }, [searchOpen])

  // Links (react-router <Link>) can't be <Button>; mirror the icon variant's look.
  const iconLinkClass = 'shrink-0 rounded p-1.5 text-base00 hover:bg-base2 dark:text-base1 dark:hover:bg-base02'

  return (
    <div className="shrink-0">
      <div className="flex h-10 shrink-0 items-center border-b border-base2 bg-base3 px-3 dark:border-base02 dark:bg-base03">
        {/* Left: back, page counter, zoom */}
        <div className="flex shrink-0 items-center gap-1 overflow-hidden">
          <Link
            to="/"
            className={iconLinkClass}
            aria-label="Back to library"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </Link>
          <span className="shrink-0 whitespace-nowrap text-sm tabular-nums text-base00 dark:text-base1">
            {currentPage} / {totalPages}
          </span>
          <div className="mx-0.5 h-4 w-px bg-base2 dark:bg-base02" />
          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              variant="icon"
              size="sm"
              onClick={() => canZoomOut && onZoomChange(Math.round(Math.max(MIN_ZOOM, zoom / ZOOM_FACTOR) * 100) / 100)}
              disabled={!canZoomOut}
              className="text-sm"
              aria-label="Zoom out"
            >
              −
            </Button>
            <button
              onClick={() => onZoomChange(1)}
              className="min-w-[3.5rem] rounded px-1 py-0.5 text-center text-sm tabular-nums text-base01 hover:bg-base2 dark:text-base1 dark:hover:bg-base02"
              aria-label="Reset zoom"
            >
              {Math.round(zoom * 100)}%
            </button>
            <Button
              variant="icon"
              size="sm"
              onClick={() => canZoomIn && onZoomChange(Math.round(Math.min(MAX_ZOOM, zoom * ZOOM_FACTOR) * 100) / 100)}
              disabled={!canZoomIn}
              className="text-sm"
              aria-label="Zoom in"
            >
              +
            </Button>
          </div>
        </div>
        {/* Center: title */}
        <span className="min-w-0 max-w-[50%] flex-1 truncate text-center text-xs text-base1 dark:text-base00">
          {title}
        </span>
        {/* Right: search, actions */}
        <div className="ml-auto flex shrink-0 items-center justify-end gap-1 overflow-hidden">
          {savedProgressPage != null && (
            <button
              onClick={onBackToProgress}
              className="shrink-0 rounded px-1.5 py-0.5 text-xs font-medium text-blue hover:bg-blue/10 dark:text-blue dark:hover:bg-blue/20"
              aria-label="Back to current page"
            >
              p.{savedProgressPage}
            </button>
          )}
          {searchOpen && (
            <div className="flex shrink items-center gap-1 overflow-hidden">
              <div className="relative flex shrink-0 items-center">
                <Input
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
                  className="w-28 sm:w-48"
                  autoFocus
                />
              </div>
              <span className="shrink-0 text-xs tabular-nums text-base00 dark:text-base1">
                {searchTotalMatches > 0
                  ? `${searchCurrentIndex + 1}/${searchTotalMatches}`
                  : searchQuery
                    ? '0/0'
                    : ''}
              </span>
              <Button
                variant="icon"
                size="sm"
                onClick={onSearchPrev}
                disabled={searchTotalMatches === 0}
                className="shrink-0 text-sm"
                aria-label="Previous match"
              >
                ‹
              </Button>
              <Button
                variant="icon"
                size="sm"
                onClick={onSearchNext}
                disabled={searchTotalMatches === 0}
                className="shrink-0 text-sm"
                aria-label="Next match"
              >
                ›
              </Button>
              <Button
                variant="icon"
                size="sm"
                onClick={onToggleSearch}
                className="shrink-0"
                aria-label="Close search"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </Button>
            </div>
          )}
          {learningTools && onToggleSnipMode && (
            <Button
              variant="icon"
              active={snipMode}
              onClick={onToggleSnipMode}
              className="shrink-0"
              aria-label={snipMode ? 'Stop snipping' : 'Snip mode'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="6" cy="6" r="3" />
                <circle cx="6" cy="18" r="3" />
                <line x1="20" y1="4" x2="8.12" y2="15.88" />
                <line x1="14.47" y1="14.48" x2="20" y2="20" />
                <line x1="8.12" y1="8.12" x2="12" y2="12" />
              </svg>
            </Button>
          )}
          {learningTools && hasSnips && onLoopSorted && onLoopShuffled && (
            <>
              <Button
                variant="icon"
                onClick={onLoopSorted}
                className="shrink-0"
                aria-label="Loop sorted"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="17 1 21 5 17 9" />
                  <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                  <polyline points="7 23 3 19 7 15" />
                  <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                </svg>
              </Button>
              <Button
                variant="icon"
                onClick={onLoopShuffled}
                className="shrink-0"
                aria-label="Loop shuffled"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 3 21 3 21 8" />
                  <line x1="4" y1="20" x2="21" y2="3" />
                  <polyline points="21 16 21 21 16 21" />
                  <line x1="15" y1="15" x2="21" y2="21" />
                  <line x1="4" y1="4" x2="9" y2="9" />
                </svg>
              </Button>
            </>
          )}
          {learningTools && <PomodoroTimer zenMode={zenMode ?? false} activeSlug={activeSlug} activeDirPath={activeDirPath} />}
          {learningTools && (
            <Link
              to="/snips"
              className={iconLinkClass}
              aria-label="Snips"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
            </Link>
          )}
          <Button
            variant="icon"
            active={searchOpen}
            onClick={onToggleSearch}
            className="shrink-0"
            aria-label="Toggle search"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </Button>
          {bookStatus && onSetBookStatus && (
            // Kept as a real <button> (focusable, Enter-activatable) wrapping the Badge.
            <button
              type="button"
              onClick={() => {
                const order = ['open', 'in-progress', 'need-revisit', 'done'] as const
                const idx = order.indexOf(bookStatus)
                onSetBookStatus(order[(idx + 1) % order.length])
              }}
              className="shrink-0"
              aria-label="Cycle book status"
            >
              <Badge
                variant="square"
                className={
                  bookStatus === 'done'
                    ? 'bg-green/20 text-green'
                    : bookStatus === 'need-revisit'
                      ? 'bg-orange/20 text-orange'
                      : bookStatus === 'in-progress'
                        ? 'bg-blue/20 text-blue'
                        : 'bg-base1/20 text-base1'
                }
              >
                {bookStatus}
              </Badge>
            </button>
          )}
          <Button
            variant="icon"
            onClick={togglePalette}
            className="shrink-0"
            aria-label="Command palette"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z" />
            </svg>
          </Button>
        </div>
      </div>
    </div>
  )
}
