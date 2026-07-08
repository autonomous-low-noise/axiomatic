import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { EditorView } from '@codemirror/view'
import type { Snip } from '../hooks/useSnips'
import { useNotes, useNoteContent } from '../hooks/useNotes'
import { NotesPanel } from './NotesPanel'
import { ZoomableSnipImage } from './ZoomableSnipImage'
import { useSwipe } from '../hooks/useSwipe'
import { usePlatform } from '../lib/platform'
import { Button } from './ui/Button'

interface LoopCarouselProps {
  snips: Snip[]
  xp: number
  onIncrementXp: () => Promise<number>
  onExit: () => void
  shuffled: boolean
  /** Optional per-snip XP increment for cross-book loops. When provided, this
   *  is called instead of onIncrementXp so that XP is credited to the correct
   *  directory + slug combination. */
  onIncrementXpForSnip?: (dirPath: string, slug: string) => Promise<void>
  /** When true: images always revealed, no XP tracking */
  viewMode?: boolean
  /** When true: no XP counter displayed, no XP increment on advance */
  noXp?: boolean
  /** Start at this index instead of 0 */
  initialIndex?: number
  /** Map for cross-device snip path resolution */
  pathMap?: Map<string, string>
  /** Library directory path for cross-device resolution */
  dirPath?: string
  /** Rename callback — receives dirPath, snip id, new label */
  onRename?: (dirPath: string, snipId: string, newLabel: string) => Promise<void>
  /** Navigate to snip's page in the reader */
  onNavigateToSnip?: (snip: Snip) => void
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function LoopCarousel({
  snips,
  xp,
  onIncrementXp,
  onExit,
  shuffled,
  onIncrementXpForSnip,
  viewMode,
  noXp,
  initialIndex,
  pathMap,
  dirPath,
  onRename,
  onNavigateToSnip,
}: LoopCarouselProps) {
  const [notesOpen, setNotesOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<EditorView | null>(null)
  const cardAreaRef = useRef<HTMLDivElement>(null)
  const { ensureNote, setNote } = useNotes()
  const platform = usePlatform()

  const [isShuffled, setIsShuffled] = useState(shuffled)

  // Stabilize order: only compute once when snips first arrive (avoids
  // re-shuffling mid-session if the snips array reference changes).
  const [orderedSnips, setOrderedSnips] = useState<Snip[]>([])
  const snipsInitializedRef = useRef(false)
  useEffect(() => {
    if (snips.length > 0 && !snipsInitializedRef.current) {
      snipsInitializedRef.current = true
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: one-time initialization on first data arrival
      setOrderedSnips(shuffled ? shuffle(snips) : [...snips])
    }
  }, [snips, shuffled])

  const [index, setIndex] = useState(initialIndex ?? 0)
  const [revealed, setRevealed] = useState(viewMode === true)
  const [displayXp, setDisplayXp] = useState(xp)

  const current = orderedSnips[index]
  const noteContent = useNoteContent(current?.slug, current?.page ?? 0)

  useEffect(() => {
    if (current) ensureNote(current.slug, current.page)
  }, [current?.slug, current?.page, ensureNote])

  const handleReveal = useCallback(() => {
    if (revealed) return
    setRevealed(true)
  }, [revealed])

  const advance = useCallback(async (snip: Snip) => {
    if (viewMode) return
    if (onIncrementXpForSnip) {
      const withDir = snip as Snip & { dirPath?: string }
      if (withDir.dirPath) {
        await onIncrementXpForSnip(withDir.dirPath, snip.slug)
      }
    } else {
      const newXp = await onIncrementXp()
      if (newXp != null) setDisplayXp(newXp)
    }
  }, [onIncrementXp, onIncrementXpForSnip, viewMode])

  const handleNext = useCallback(() => {
    const currentSnip = orderedSnips[index]
    if (isShuffled && index === orderedSnips.length - 1) {
      // Completed a full loop in shuffle mode: re-shuffle for the next pass
      setOrderedSnips(shuffle(snips))
      setIndex(0)
    } else {
      setIndex((i) => (i + 1) % orderedSnips.length)
    }
    if (!viewMode) setRevealed(false)
    if (currentSnip) advance(currentSnip)
  }, [orderedSnips, index, isShuffled, snips, advance, viewMode])

  const handlePrev = useCallback(() => {
    setIndex((i) => (i - 1 + orderedSnips.length) % orderedSnips.length)
    if (!viewMode) setRevealed(false)
  }, [orderedSnips.length, viewMode])

  const startRename = useCallback(() => {
    if (!current || !onRename) return
    setRenameValue(current.label)
    setRenaming(true)
    setTimeout(() => renameInputRef.current?.select(), 0)
  }, [current, onRename])

  const commitRename = useCallback(async () => {
    if (!current || !onRename) return
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== current.label) {
      const withDir = current as Snip & { dirPath?: string }
      const dp = withDir.dirPath ?? dirPath ?? ''
      await onRename(dp, current.id, trimmed)
      // Update label in orderedSnips so it reflects immediately
      setOrderedSnips((prev) => prev.map((s) => s.id === current.id ? { ...s, label: trimmed } : s))
    }
    setRenaming(false)
  }, [current, onRename, renameValue, dirPath])

  const cancelRename = useCallback(() => {
    setRenaming(false)
  }, [])

  const handleToggleShuffle = useCallback(() => {
    const next = !isShuffled
    setIsShuffled(next)
    setOrderedSnips(next ? shuffle(snips) : [...snips])
    setIndex(0)
    setRevealed(viewMode === true)
  }, [isShuffled, snips, viewMode])

  const swipeHandlers = useMemo(() => ({
    onSwipeLeft: handleNext,
    onSwipeRight: handlePrev,
    onTap: handleReveal,
  }), [handleNext, handlePrev, handleReveal])
  useSwipe(cardAreaRef, swipeHandlers)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+L: toggle notes panel
      if (e.ctrlKey && e.key === 'l') {
        e.preventDefault()
        setNotesOpen((v) => {
          if (!v) {
            setTimeout(() => editorRef.current?.focus(), 50)
          }
          return !v
        })
        return
      }

      // Ctrl+H: close notes if in editor, else exit carousel
      if (e.ctrlKey && e.key === 'h') {
        e.preventDefault()
        const el = document.activeElement
        if (el?.closest('.cm-editor')) {
          ;(el as HTMLElement).blur()
          setNotesOpen(false)
        } else {
          onExit()
        }
        return
      }

      const el = document.activeElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.closest('.cm-editor'))) return

      switch (e.key) {
        case ' ':
          e.preventDefault()
          setRevealed((r) => !r)
          break
        case 'j':
        case 'ArrowRight':
          e.preventDefault()
          handleNext()
          break
        case 'k':
        case 'ArrowLeft':
          e.preventDefault()
          handlePrev()
          break
        case 'r':
          e.preventDefault()
          startRename()
          break
        case 'o':
          if (onNavigateToSnip && orderedSnips[index]) {
            e.preventDefault()
            onNavigateToSnip(orderedSnips[index])
          }
          break
        case 'Escape':
          e.preventDefault()
          onExit()
          break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleNext, handlePrev, onExit, startRename, onNavigateToSnip, orderedSnips, index])

  if (!current) {
    return (
      <div className="flex flex-1 items-center justify-center bg-base3 dark:bg-base03">
        <p className="text-base00 dark:text-base1">No snips to review.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1">
      <div ref={cardAreaRef} className="flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto bg-base3 p-4 sm:justify-center sm:gap-6 sm:p-8 dark:bg-base03">
        {/* Header */}
        <div className="flex w-full max-w-full items-center justify-between sm:max-w-2xl">
          <span className="text-sm text-base1 dark:text-base01">
            {index + 1} / {orderedSnips.length}
          </span>
          <div className="flex items-center gap-3">
            {!viewMode && (
              <button
                onClick={handleToggleShuffle}
                aria-label="Toggle shuffle"
                className={`rounded border px-2.5 py-1 text-xs font-medium transition-colors ${
                  isShuffled
                    ? 'border-blue/50 bg-blue/10 text-blue'
                    : 'border-base1/30 text-base1 hover:border-blue/50 hover:text-blue dark:text-base01'
                }`}
              >
                {isShuffled ? 'Shuffled' : 'Sorted'}
              </button>
            )}
            {!viewMode && !noXp && !onIncrementXpForSnip && (
              <span className="text-sm font-medium text-yellow">
                {displayXp} XP
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            onClick={onExit}
            className="min-h-[44px] min-w-[44px]"
            aria-label="Exit carousel"
          >
            {platform.isMobile ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
            ) : (
              'ESC to exit'
            )}
          </Button>
        </div>

        {/* Card */}
        <div className={`flex w-full flex-col items-center gap-4 overflow-hidden rounded-lg border border-base2 bg-white p-4 shadow-sm sm:p-8 dark:border-base02 dark:bg-base02 ${revealed ? 'max-w-full' : 'max-w-full sm:max-w-2xl'}`}>
          {renaming ? (
            <input
              ref={renameInputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename()
                else if (e.key === 'Escape') cancelRename()
                e.stopPropagation()
              }}
              onBlur={commitRename}
              className="w-full max-w-md rounded border border-blue bg-transparent text-center text-2xl font-semibold text-base00 outline-none dark:text-base1"
            />
          ) : (
            <h2
              className="text-center text-2xl font-semibold text-base00 dark:text-base1"
              onDoubleClick={onRename ? startRename : undefined}
            >
              {current.label}
            </h2>
          )}
          {onNavigateToSnip ? (
            <button
              onClick={() => onNavigateToSnip(current)}
              className="text-sm text-blue hover:underline"
              aria-label="Open in reader"
            >
              p. {current.page} — open in reader (o)
            </button>
          ) : (
            <p className="text-sm text-base1 dark:text-base01">
              p. {current.page}
            </p>
          )}

          {revealed ? (
            <ZoomableSnipImage snip={current} maxHeight="60vh" globalShortcuts pathMap={pathMap} dirPath={dirPath} />
          ) : (
            <Button
              variant="primary"
              size="lg"
              onClick={handleReveal}
              className="mt-4 px-8 py-3 text-lg"
            >
              Reveal
            </Button>
          )}
        </div>

        {/* Navigation */}
        <div className="flex gap-4">
          <Button
            variant="icon"
            onClick={handlePrev}
            aria-label="Previous"
            className="min-h-[44px] min-w-[44px] px-4 py-2 text-sm"
          >
            {platform.isMobile ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            ) : (
              'Prev (k)'
            )}
          </Button>
          <Button
            variant="icon"
            onClick={handleNext}
            aria-label="Next"
            className="min-h-[44px] min-w-[44px] px-4 py-2 text-sm"
          >
            {platform.isMobile ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            ) : (
              'Next (j)'
            )}
          </Button>
        </div>
      </div>

      {notesOpen && current && (
        <NotesPanel
          slug={current.slug}
          page={current.page}
          content={noteContent}
          onUpdate={setNote}
          externalEditorRef={editorRef}
        />
      )}
    </div>
  )
}
