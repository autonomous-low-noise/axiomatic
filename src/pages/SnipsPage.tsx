import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { invoke } from '@tauri-apps/api/core'
import type { EditorView } from '@codemirror/view'
import { useDirectories } from '../hooks/useDirectories'
import { useDirPaths } from '../hooks/useDirPaths'
import { usePathMap } from '../hooks/usePathMap'
import { useTextbooks } from '../hooks/useTextbooks'
import { useAllSnips } from '../hooks/useSnips'
import type { SnipWithDir } from '../hooks/useSnips'
import { useSnipTagDefs } from '../hooks/useSnipTagDefs'
import { useNotes, useNoteContent } from '../hooks/useNotes'
import { togglePalette } from '../lib/palette'
import { sol } from '../lib/solarized'
import { TAG_PALETTE } from '../lib/tagPalette'
import { cx } from '../lib/cx'
import { Z } from '../lib/zIndex'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'
import { Menu } from '../components/ui/Menu'
import { LoopCarousel } from '../components/LoopCarousel'
import { NotesPanel } from '../components/NotesPanel'
import { PomodoroTimer } from '../components/PomodoroTimer'
import { ZoomableSnipImage } from '../components/ZoomableSnipImage'
import { SnipTagManager } from '../components/SnipTagManager'
import { SnipTagAssigner } from '../components/SnipTagAssigner'

interface ContextMenuState {
  x: number
  y: number
  snip: SnipWithDir
}

const FILTER_STORAGE_KEY = 'axiomatic:snips-filter'

type SortKey = 'created_at' | 'label' | 'source' | 'page' | 'status'
type SortDir = 'asc' | 'desc'
interface SortColumn { key: SortKey; dir: SortDir }

interface FilterCache {
  search: string
  dirFilter: string
  selectedTags: string[]
  sortColumns: SortColumn[]
  /** @deprecated — migrated to sortColumns */
  sortKey?: SortKey
  /** @deprecated — migrated to sortColumns */
  sortDir?: SortDir
}

const DEFAULT_SORT: SortColumn[] = [{ key: 'created_at', dir: 'asc' }]

function loadFilterCache(): FilterCache {
  try {
    const raw = localStorage.getItem(FILTER_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      // Migrate old single sortKey/sortDir to sortColumns
      if (!parsed.sortColumns && parsed.sortKey) {
        parsed.sortColumns = [{ key: parsed.sortKey, dir: parsed.sortDir ?? 'asc' }]
        delete parsed.sortKey
        delete parsed.sortDir
      }
      if (!parsed.sortColumns) parsed.sortColumns = DEFAULT_SORT
      return parsed
    }
  } catch { /* ignore */ }
  return { search: '', dirFilter: 'all', selectedTags: [], sortColumns: DEFAULT_SORT }
}

function saveFilterCache(cache: FilterCache) {
  localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(cache))
}

// Module-level cache: survives unmount/remount within session, persists across restarts via localStorage
const _filterCache = loadFilterCache()

/** @internal — test-only reset */
// eslint-disable-next-line react-refresh/only-export-components
export function _resetFilterCache() {
  _filterCache.search = ''
  _filterCache.dirFilter = 'all'
  _filterCache.selectedTags = []
  _filterCache.sortColumns = [{ key: 'created_at', dir: 'asc' }]
  localStorage.removeItem(FILTER_STORAGE_KEY)
}

export function SnipsPage() {
  const navigate = useNavigate()
  const { directories } = useDirectories()
  const { textbooks, loading: booksLoading } = useTextbooks()
  const {
    snips, loading: snipsLoading, addTag, removeTag,
    renameSnip, deleteSnip, bulkAddTag, bulkRemoveTag, setSnipStatus, bulkSetSnipStatus, refresh: refreshSnips,
  } = useAllSnips(directories)

  const dirPaths = useDirPaths(directories)

  const pathMap = usePathMap(textbooks)
  const { defs: tagDefs, createDef, deleteDef, renameDef, recolorDef } = useSnipTagDefs(dirPaths)

  // Build a color lookup from tag defs
  const tagColorMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const d of tagDefs) map.set(d.name, d.color)
    return map
  }, [tagDefs])

  const [search, _setSearch] = useState(_filterCache.search)
  const setSearch = useCallback((v: string | ((prev: string) => string)) => {
    _setSearch((prev) => { const next = typeof v === 'function' ? v(prev) : v; _filterCache.search = next; saveFilterCache(_filterCache); return next })
  }, [])
  const [dirFilter, _setDirFilter] = useState<string>(_filterCache.dirFilter)
  const setDirFilter = useCallback((v: string) => { _filterCache.dirFilter = v; _setDirFilter(v); _filterCache.selectedTags = []; _setSelectedTags([]); setSelectedIds(new Set()); saveFilterCache(_filterCache) }, [])
  const [selectedTags, _setSelectedTags] = useState<string[]>(_filterCache.selectedTags)
  const setSelectedTags = useCallback((v: string[] | ((prev: string[]) => string[])) => {
    _setSelectedTags((prev) => { const next = typeof v === 'function' ? v(prev) : v; _filterCache.selectedTags = next; saveFilterCache(_filterCache); return next })
  }, [])
  const [sortColumns, setSortColumns] = useState<SortColumn[]>(_filterCache.sortColumns)
  const toggleSort = useCallback((key: SortKey, shiftKey: boolean) => {
    setSortColumns((prev) => {
      let next: SortColumn[]
      const idx = prev.findIndex((c) => c.key === key)
      if (shiftKey) {
        // Shift+click: add column or toggle direction of existing
        next = [...prev]
        if (idx >= 0) {
          next[idx] = { key, dir: next[idx].dir === 'asc' ? 'desc' : 'asc' }
        } else {
          next.push({ key, dir: 'asc' })
        }
      } else {
        // Plain click: single-column sort, toggle if same key
        if (prev.length === 1 && prev[0].key === key) {
          next = [{ key, dir: prev[0].dir === 'asc' ? 'desc' : 'asc' }]
        } else {
          next = [{ key, dir: 'asc' }]
        }
      }
      _filterCache.sortColumns = next
      saveFilterCache(_filterCache)
      return next
    })
  }, [])
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false)
  const [tagSearch, setTagSearch] = useState('')
  const [loopOpen, setLoopOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [tagManagerOpen, setTagManagerOpen] = useState(false)
  const [tagAssignerOpen, setTagAssignerOpen] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [viewStartIndex, setViewStartIndex] = useState<number | null>(null)
  const [notesOpen, setNotesOpen] = useState(false)

  const searchRef = useRef<HTMLInputElement>(null)
  const tableRef = useRef<HTMLDivElement>(null)
  const tagFilterBtnRef = useRef<HTMLButtonElement>(null)
  const tagManagerBtnRef = useRef<HTMLButtonElement>(null)
  const editorRef = useRef<EditorView | null>(null)

  const { ensureNote, setNote } = useNotes()

  const loading = booksLoading || snipsLoading

  const slugToTitle = useMemo(() => {
    const map: Record<string, string> = {}
    for (const book of textbooks) map[book.slug] = book.title
    return map
  }, [textbooks])

  const uniqueTags = useMemo(() => {
    const tags = new Set<string>()
    for (const s of snips) for (const t of s.tags) tags.add(t)
    return Array.from(tags).sort()
  }, [snips])

  const filteredSnips = useMemo(() => {
    let result = snips
    if (dirFilter !== 'all') result = result.filter((s) => s.dirPath === dirFilter)
    if (selectedTags.length > 0) {
      const isBatch = (t: string) => t.toLowerCase().includes('batch')
      const andTags = selectedTags.filter((t) => !isBatch(t))
      const orTags = selectedTags.filter(isBatch)
      result = result.filter((s) =>
        andTags.every((t) => s.tags.includes(t)) &&
        (orTags.length === 0 || orTags.some((t) => s.tags.includes(t))),
      )
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter((s) => s.label.toLowerCase().includes(q))
    }
    return [...result].sort((a, b) => {
      for (const { key, dir } of sortColumns) {
        const m = dir === 'asc' ? 1 : -1
        let cmp = 0
        switch (key) {
          case 'label': cmp = a.label.localeCompare(b.label); break
          case 'source': cmp = (slugToTitle[a.slug] ?? a.slug).localeCompare(slugToTitle[b.slug] ?? b.slug); break
          case 'page': cmp = a.page - b.page; break
          case 'status': cmp = a.status.localeCompare(b.status); break
          default: cmp = a.created_at.localeCompare(b.created_at); break
        }
        if (cmp !== 0) return cmp * m
      }
      return a.slug.localeCompare(b.slug) || a.page - b.page
    })
  }, [snips, dirFilter, selectedTags, search, sortColumns, slugToTitle])

  const highlightedSnip = selectedIndex >= 0 ? filteredSnips[selectedIndex] : undefined
  const noteContent = useNoteContent(highlightedSnip?.slug, highlightedSnip?.page ?? 0)

  useEffect(() => {
    if (highlightedSnip && notesOpen) ensureNote(highlightedSnip.slug, highlightedSnip.page)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- slug+page are the meaningful deps, not the full object
  }, [highlightedSnip?.slug, highlightedSnip?.page, notesOpen, ensureNote])

  // Clamp selectedIndex when filtered rows change
  useEffect(() => {
     
    setSelectedIndex((prev) => {
      if (filteredSnips.length === 0) return -1
      if (prev >= filteredSnips.length) return filteredSnips.length - 1
      return prev
    })
  }, [filteredSnips.length])

  // Clear selection when snips change
  useEffect(() => {
     
    setSelectedIds((prev) => {
      const validIds = new Set(snips.map((s) => s.id))
      const next = new Set([...prev].filter((id) => validIds.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [snips])

  const navigateToSnip = useCallback(
    (snip: { slug: string; page: number }) => navigate(`/read/${snip.slug}?page=${snip.page}`),
    [navigate],
  )

  // Vim j/k navigation
  useEffect(() => {
    if (loopOpen || viewStartIndex !== null) return
    const handler = (e: KeyboardEvent) => {
      // Escape always closes panes regardless of focus
      if (e.key === 'Escape') {
        e.preventDefault()
        if (notesOpen) setNotesOpen(false)
        else if (tagManagerOpen) setTagManagerOpen(false)
        else if (tagAssignerOpen) setTagAssignerOpen(false)
        else if (selectedIds.size > 0) setSelectedIds(new Set())
        else navigate('/')
        return
      }

      // Ctrl+L: toggle notes panel for highlighted snip
      if (e.ctrlKey && e.key === 'l') {
        e.preventDefault()
        setNotesOpen((v) => {
          if (!v && selectedIndex >= 0) {
            const snip = filteredSnips[selectedIndex]
            if (snip) ensureNote(snip.slug, snip.page)
            setTimeout(() => editorRef.current?.focus(), 50)
          }
          return !v
        })
        return
      }

      // Ctrl+H: close notes if open, else navigate to library
      if (e.ctrlKey && e.key === 'h') {
        e.preventDefault()
        if (notesOpen) {
          setNotesOpen(false)
        } else {
          navigate('/')
        }
        return
      }

      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if ((e.target as HTMLElement).closest?.('.cm-editor')) return
      const count = filteredSnips.length
      if (count === 0 && e.key !== '/') return

      switch (e.key) {
        case 'j': case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((prev) => prev === -1 ? 0 : Math.min(prev + 1, count - 1))
          break
        case 'k': case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((prev) => prev <= 0 ? prev : prev - 1)
          break
        case 'l':
          if (selectedIndex >= 0 && selectedIndex < count) {
            e.preventDefault()
            setExpandedIds((prev) => {
              const next = new Set(prev)
              next.add(filteredSnips[selectedIndex].id)
              return next
            })
          }
          break
        case 'h':
          if (selectedIndex >= 0 && selectedIndex < count) {
            e.preventDefault()
            setExpandedIds((prev) => {
              const next = new Set(prev)
              next.delete(filteredSnips[selectedIndex].id)
              return next
            })
          }
          break
        case 'Enter':
          if (selectedIndex >= 0 && selectedIndex < count) {
            e.preventDefault()
            navigateToSnip(filteredSnips[selectedIndex])
          }
          break
        case '/':
          e.preventDefault()
          searchRef.current?.focus()
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [filteredSnips, selectedIndex, navigateToSnip, navigate, loopOpen, viewStartIndex, selectedIds.size, notesOpen, tagManagerOpen, tagAssignerOpen, ensureNote])

  // Scroll selected row into view
  useEffect(() => {
    if (selectedIndex < 0 || !tableRef.current) return
    const row = tableRef.current.querySelector(`[data-row-index="${selectedIndex}"]`)
    row?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  const toggleTagFilter = useCallback((tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    )
  }, [])

  const incrementXpForSnip = useCallback(async (dirPath: string, slug: string) => {
    try { await invoke<number>('increment_xp', { dirPath, slug }) }
    catch (err) { console.error('increment_xp failed:', err) }
  }, [])

  // Multi-select helpers
  const toggleSelect = useCallback((id: string, shiftKey: boolean) => {
    if (shiftKey && selectedIds.size > 0) {
      // Shift-click: range select from last selected to current
      const lastSelected = [...selectedIds].pop()!
      const lastIdx = filteredSnips.findIndex((s) => s.id === lastSelected)
      const currentIdx = filteredSnips.findIndex((s) => s.id === id)
      if (lastIdx >= 0 && currentIdx >= 0) {
        const [start, end] = lastIdx < currentIdx ? [lastIdx, currentIdx] : [currentIdx, lastIdx]
        const next = new Set(selectedIds)
        for (let i = start; i <= end; i++) next.add(filteredSnips[i].id)
        setSelectedIds(next)
        return
      }
    }
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [selectedIds, filteredSnips])

  const selectAll = useCallback(() => {
    if (selectedIds.size > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredSnips.map((s) => s.id)))
    }
  }, [selectedIds.size, filteredSnips])

  const selectedSnips = useMemo(
    () => filteredSnips.filter((s) => selectedIds.has(s.id)),
    [filteredSnips, selectedIds],
  )

  // Inline rename
  const startRename = useCallback((snip: SnipWithDir) => {
    setRenamingId(snip.id)
    setRenameValue(snip.label)
  }, [])

  const commitRename = useCallback(async () => {
    if (!renamingId) return
    const snip = snips.find((s) => s.id === renamingId)
    if (snip && renameValue.trim() && renameValue.trim() !== snip.label) {
      await renameSnip(snip.dirPath, snip.id, renameValue.trim())
    }
    setRenamingId(null)
  }, [renamingId, renameValue, snips, renameSnip])

  // Delete selected snips
  const handleDeleteSelected = useCallback(async () => {
    const toDelete = snips.filter((s) => selectedIds.has(s.id))
    for (const snip of toDelete) {
      await deleteSnip(snip.dirPath, snip.id)
    }
    setSelectedIds(new Set())
  }, [selectedIds, snips, deleteSnip])

  // Context menu
  const handleContextMenu = useCallback((e: React.MouseEvent, snip: SnipWithDir) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, snip })
  }, [])

  // Tag def CRUD with snip refresh
  const handleCreateDef = useCallback(async (name: string, color: string) => {
    await createDef(name, color)
  }, [createDef])

  const handleDeleteDef = useCallback(async (name: string) => {
    await deleteDef(name)
    await refreshSnips()
  }, [deleteDef, refreshSnips])

  const handleRenameDef = useCallback(async (oldName: string, newName: string) => {
    await renameDef(oldName, newName)
    await refreshSnips()
  }, [renameDef, refreshSnips])

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-base3 dark:bg-base03">
        <p className="text-base00 dark:text-base1">Loading snips...</p>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-base3 dark:bg-base03">
      {/* Toolbar */}
      <div className="flex h-10 shrink-0 flex-wrap items-center gap-1 border-b border-base2 bg-base3 px-2 dark:border-base02 dark:bg-base03">
        <Button
          variant="icon"
          onClick={() => navigate('/')}
          className="shrink-0"
          aria-label="Back to library"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </Button>

        <h1 className="shrink-0 text-sm font-medium text-base01 dark:text-base1">Snips</h1>

        <select
          value={dirFilter}
          onChange={(e) => setDirFilter(e.target.value)}
          className="h-7 rounded border border-base1/30 bg-base3 px-2 text-xs text-base01 outline-none focus:border-blue dark:border-base02 dark:bg-base02 dark:text-base1 dark:focus:border-blue"
        >
          <option value="all">All directories</option>
          {directories.map((dir) => (
            <option key={dir.id} value={dir.path}>{dir.label}</option>
          ))}
        </select>

        {/* Tag filter dropdown with colored pills */}
        <Button
          ref={tagFilterBtnRef}
          variant="secondary"
          size="sm"
          onClick={() => setTagDropdownOpen((v) => !v)}
          className="h-7 shrink-0"
        >
          {selectedTags.length === 0
            ? 'All tags'
            : `${selectedTags.length} tag${selectedTags.length !== 1 ? 's' : ''}`}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </Button>
        {tagDropdownOpen && uniqueTags.length > 0 && (
          <Menu
            anchorRef={tagFilterBtnRef}
            onClose={() => { setTagDropdownOpen(false); setTagSearch('') }}
            className="w-48 sm:w-56"
          >
            <div className="px-2 pb-1">
              <Input
                type="text"
                inputSize="sm"
                surface="panel"
                value={tagSearch}
                onChange={(e) => setTagSearch(e.target.value)}
                placeholder="Search tags..."
                className="w-full"
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
            {selectedTags.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedTags([])}
                className="block w-full px-3 py-1 text-left text-xs text-blue hover:bg-base2 dark:hover:bg-base03"
              >
                Clear all
              </button>
            )}
            <div className="max-h-40 overflow-y-auto">
              {uniqueTags
                .filter((tag) => !tagSearch.trim() || tag.toLowerCase().includes(tagSearch.trim().toLowerCase()))
                .map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTagFilter(tag)}
                  className="flex w-full items-center gap-2 px-3 py-1 text-left text-xs text-base01 hover:bg-base2 dark:text-base1 dark:hover:bg-base03"
                >
                  <span className={`inline-block h-3 w-3 shrink-0 rounded-sm border ${
                    selectedTags.includes(tag)
                      ? 'border-blue bg-blue'
                      : 'border-base1/50 bg-transparent'
                  }`} />
                  {tagColorMap.has(tag) && (
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: tagColorMap.get(tag) }} />
                  )}
                  {tag}
                </button>
              ))}
            </div>
          </Menu>
        )}

        <Button
          variant="primary"
          size="sm"
          onClick={() => setLoopOpen(true)}
          disabled={filteredSnips.length === 0}
          className="h-7 shrink-0"
        >
          Loop
        </Button>

        {/* Tag manager button */}
        <Button
          ref={tagManagerBtnRef}
          variant="secondary"
          size="sm"
          onClick={() => setTagManagerOpen((v) => !v)}
          className="h-7 shrink-0"
        >
          Manage tags
        </Button>

        {/* Select mode toggle */}
        <Button
          variant="icon"
          active={selectMode}
          onClick={() => { setSelectMode((v) => !v); if (selectMode) setSelectedIds(new Set()) }}
          aria-label="Toggle select mode"
          className="shrink-0"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 11 12 14 22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
        </Button>

        {/* Selection toolbar */}
        {selectMode && selectedIds.size > 0 && (
          <>
            <div className="mx-1 h-4 w-px bg-base1/30 dark:bg-base02" />
            <span className="text-xs text-base01 dark:text-base1">
              {selectedIds.size} selected
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setTagAssignerOpen(true)}
              className="h-7 shrink-0"
            >
              Tag
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDeleteSelected}
              className="h-7 shrink-0"
            >
              Delete
            </Button>
          </>
        )}

        <div className="flex-1" />

        <div className="relative flex shrink-0 items-center">
          <Input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                e.stopPropagation()
                setSearch('')
                searchRef.current?.blur()
              }
            }}
            placeholder="Search snips... (/)"
            className="w-28 pr-7 sm:w-52"
          />
          {search && (
            <Button
              variant="icon"
              size="sm"
              onClick={() => { setSearch(''); searchRef.current?.focus() }}
              className="absolute right-0.5"
              aria-label="Clear search"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </Button>
          )}
        </div>

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

      {/* Table + Notes */}
      <div className="flex min-h-0 flex-1">
      <div ref={tableRef} className="min-h-0 flex-1 overflow-y-auto">
        {filteredSnips.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-base1 dark:text-base00">
            <p className="text-sm">
              {snips.length === 0
                ? 'No snips yet. Open a book and use the snip tool to capture regions.'
                : 'No snips match the current filters.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className={`sticky top-0 ${Z.raised} bg-base2 text-xs font-medium uppercase tracking-wider text-base1 dark:bg-base02 dark:text-base01`}>
              <tr>
                {selectMode && (
                  <th className="w-8 px-2 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredSnips.length && filteredSnips.length > 0}
                      ref={(el) => {
                        if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < filteredSnips.length
                      }}
                      onChange={selectAll}
                      className="h-4 w-4 accent-blue"
                    />
                  </th>
                )}
                {(['label', 'source', 'page'] as SortKey[]).map((key) => {
                  const idx = sortColumns.findIndex((c) => c.key === key)
                  const col = idx >= 0 ? sortColumns[idx] : null
                  const arrow = col ? (col.dir === 'asc' ? '▲' : '▼') : ''
                  const rank = col && sortColumns.length > 1 ? `${idx + 1}` : ''
                  const label = key === 'page' ? 'Page' : key.charAt(0).toUpperCase() + key.slice(1)
                  return (
                    <th
                      key={key}
                      className={`cursor-pointer px-4 py-2 select-none${key === 'page' ? ' text-right' : ''}`}
                      onClick={(e) => toggleSort(key, e.shiftKey)}
                    >
                      {label}
                      {arrow && <span className="ml-1 text-[10px]">{arrow}{rank}</span>}
                    </th>
                  )
                })}
                <th className="px-4 py-2">Tags</th>
                {(['status', 'created_at'] as SortKey[]).map((key) => {
                  const idx = sortColumns.findIndex((c) => c.key === key)
                  const col = idx >= 0 ? sortColumns[idx] : null
                  const arrow = col ? (col.dir === 'asc' ? '▲' : '▼') : ''
                  const rank = col && sortColumns.length > 1 ? `${idx + 1}` : ''
                  const label = key === 'created_at' ? 'Created' : 'Status'
                  return (
                    <th
                      key={key}
                      className="cursor-pointer px-4 py-2 select-none"
                      onClick={(e) => toggleSort(key, e.shiftKey)}
                    >
                      {label}
                      {arrow && <span className="ml-1 text-[10px]">{arrow}{rank}</span>}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {filteredSnips.map((snip, i) => {
                const isSelected = selectedIds.has(snip.id)
                return (
                  <React.Fragment key={snip.id}>
                  <tr
                    data-row-index={i}
                    onClick={(e) => {
                      if (!selectMode) return
                      if ((e.target as HTMLElement).closest('input[type="checkbox"]')) return
                      if ((e.target as HTMLElement).closest('input[type="text"]')) return
                      if (renamingId) return
                      toggleSelect(snip.id, e.shiftKey)
                    }}
                    onContextMenu={(e) => handleContextMenu(e, snip)}
                    className={`border-b border-base2 select-none dark:border-base02 ${
                      i === selectedIndex
                        ? 'bg-base2 dark:bg-base02'
                        : isSelected
                          ? 'bg-base2/70 dark:bg-base02/70'
                          : 'hover:bg-base2/50 dark:hover:bg-base02/50'
                    }`}
                  >
                    {selectMode && (
                    <td className="w-8 px-2 py-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => toggleSelect(snip.id, e.nativeEvent instanceof MouseEvent && e.nativeEvent.shiftKey)}
                        className="h-4 w-4 accent-blue"
                      />
                    </td>
                    )}
                    <td
                      className="px-4 py-2 text-base02 dark:text-base2"
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        startRename(snip)
                      }}
                    >
                      {renamingId === snip.id ? (
                        <Input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={commitRename}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitRename()
                            if (e.key === 'Escape') setRenamingId(null)
                            e.stopPropagation()
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full"
                        />
                      ) : (
                        snip.label
                      )}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-2 text-base01 dark:text-base1">
                      {slugToTitle[snip.slug] ?? snip.slug}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-base01 dark:text-base1">
                      {snip.page}
                    </td>
                    <td className="px-4 py-2">
                      {snip.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {snip.tags.map((tag) => (
                            <Badge
                              key={tag}
                              variant="pill"
                              style={{
                                backgroundColor: (tagColorMap.get(tag) ?? sol.base1) + '20',
                                color: tagColorMap.get(tag) ?? sol.base01,
                              }}
                            >
                              <span
                                className="inline-block h-1.5 w-1.5 rounded-full"
                                style={{ backgroundColor: tagColorMap.get(tag) ?? sol.base1 }}
                              />
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-base1/50 dark:text-base01/50">--</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          const next = snip.status === 'open' ? 'solid' : snip.status === 'solid' ? 'attention' : 'open'
                          setSnipStatus(snip.dirPath, snip.id, next)
                        }}
                      >
                        <Badge
                          variant="pill"
                          className={cx(
                            'cursor-pointer font-medium',
                            snip.status === 'solid'
                              ? 'bg-green/20 text-green'
                              : snip.status === 'attention'
                                ? 'bg-orange/20 text-orange'
                                : 'bg-base1/20 text-base1',
                          )}
                        >
                          {snip.status}
                        </Badge>
                      </button>
                    </td>
                    <td className="px-4 py-2 tabular-nums text-base1 dark:text-base01">
                      {snip.created_at.slice(0, 10)}
                    </td>
                  </tr>
                  {expandedIds.has(snip.id) && (
                    <tr className="border-b border-base2 bg-base2/30 dark:border-base02 dark:bg-base02/30">
                      <td colSpan={selectMode ? 8 : 7} className="px-4 py-4">
                        <div className="flex gap-6">
                          <ZoomableSnipImage snip={snip} maxHeight="200px" pathMap={pathMap} dirPath={snip.dirPath} />
                          <div className="flex flex-col gap-2 text-sm text-base01 dark:text-base1">
                            <p><span className="font-medium">Source:</span> {slugToTitle[snip.slug] ?? snip.slug}</p>
                            <p><span className="font-medium">Page:</span> {snip.page}</p>
                            <p><span className="font-medium">Region:</span> ({(snip.x * 100).toFixed(0)}%, {(snip.y * 100).toFixed(0)}%) {(snip.width * 100).toFixed(0)}%×{(snip.height * 100).toFixed(0)}%</p>
                            <div className="mt-2 flex gap-2">
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => navigateToSnip(snip)}
                              >
                                Go to page
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setExpandedIds((prev) => { const next = new Set(prev); next.delete(snip.id); return next })}
                              >
                                Collapse
                              </Button>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {notesOpen && highlightedSnip && (
        <NotesPanel
          slug={highlightedSnip.slug}
          page={highlightedSnip.page}
          content={noteContent}
          onUpdate={setNote}
          externalEditorRef={editorRef}
        />
      )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <SnipContextMenu
          point={{ x: contextMenu.x, y: contextMenu.y }}
          snip={snips.find((s) => s.id === contextMenu.snip.id) ?? contextMenu.snip}
          tagDefs={tagDefs}
          onView={() => {
            const idx = filteredSnips.findIndex((s) => s.id === contextMenu.snip.id)
            setViewStartIndex(idx >= 0 ? idx : 0)
            setContextMenu(null)
          }}
          onExpand={() => {
            setExpandedIds((prev) => {
              const next = new Set(prev)
              if (next.has(contextMenu.snip.id)) next.delete(contextMenu.snip.id)
              else next.add(contextMenu.snip.id)
              return next
            })
            setContextMenu(null)
          }}
          onNavigate={() => { navigateToSnip(contextMenu.snip); setContextMenu(null) }}
          onRename={() => { startRename(contextMenu.snip); setContextMenu(null) }}
          onDelete={async () => {
            await deleteSnip(contextMenu.snip.dirPath, contextMenu.snip.id)
            setContextMenu(null)
          }}
          bulkSnips={selectedIds.has(contextMenu.snip.id) && selectedIds.size > 1 ? selectedSnips : null}
          onAddTag={async (tag) => {
            if (selectedIds.has(contextMenu.snip.id) && selectedIds.size > 1) {
              // Bulk tag: group by dirPath
              const byDir = new Map<string, string[]>()
              for (const s of selectedSnips) {
                const ids = byDir.get(s.dirPath) ?? []
                ids.push(s.id)
                byDir.set(s.dirPath, ids)
              }
              for (const [dirPath, ids] of byDir) await bulkAddTag(dirPath, ids, tag)
            } else {
              await addTag(contextMenu.snip.dirPath, contextMenu.snip.id, tag)
            }
          }}
          onRemoveTag={async (tag) => {
            if (selectedIds.has(contextMenu.snip.id) && selectedIds.size > 1) {
              const byDir = new Map<string, string[]>()
              for (const s of selectedSnips) {
                const ids = byDir.get(s.dirPath) ?? []
                ids.push(s.id)
                byDir.set(s.dirPath, ids)
              }
              for (const [dirPath, ids] of byDir) await bulkRemoveTag(dirPath, ids, tag)
            } else {
              await removeTag(contextMenu.snip.dirPath, contextMenu.snip.id, tag)
            }
          }}
          onCreateTag={async (name) => {
            const color = TAG_PALETTE[tagDefs.length % 8]
            await handleCreateDef(name, color)
            // Also assign the tag to the snip(s)
            if (selectedIds.has(contextMenu.snip.id) && selectedIds.size > 1) {
              const byDir = new Map<string, string[]>()
              for (const s of selectedSnips) {
                const ids = byDir.get(s.dirPath) ?? []
                ids.push(s.id)
                byDir.set(s.dirPath, ids)
              }
              for (const [dirPath, ids] of byDir) await bulkAddTag(dirPath, ids, name)
            } else {
              await addTag(contextMenu.snip.dirPath, contextMenu.snip.id, name)
            }
          }}
          onSetStatus={async (status) => {
            if (selectedIds.has(contextMenu.snip.id) && selectedIds.size > 1) {
              const byDir = new Map<string, string[]>()
              for (const s of selectedSnips) {
                const ids = byDir.get(s.dirPath) ?? []
                ids.push(s.id)
                byDir.set(s.dirPath, ids)
              }
              for (const [dirPath, ids] of byDir) await bulkSetSnipStatus(dirPath, ids, status)
            } else {
              await setSnipStatus(contextMenu.snip.dirPath, contextMenu.snip.id, status)
            }
          }}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Tag Manager popover */}
      {tagManagerOpen && (
        <SnipTagManager
          defs={tagDefs}
          anchorRef={tagManagerBtnRef}
          onCreate={handleCreateDef}
          onDelete={handleDeleteDef}
          onRename={handleRenameDef}
          onRecolor={recolorDef}
          onClose={() => setTagManagerOpen(false)}
        />
      )}

      {/* Tag Assigner sidebar */}
      {tagAssignerOpen && selectedSnips.length > 0 && (
        <SnipTagAssigner
          defs={tagDefs}
          selectedSnips={selectedSnips}
          onBulkAdd={bulkAddTag}
          onBulkRemove={bulkRemoveTag}
          onClose={() => setTagAssignerOpen(false)}
        />
      )}

      {/* Footer */}
      <div className="flex h-6 shrink-0 items-center border-t border-base2 bg-base3 px-3 dark:border-base02 dark:bg-base03">
        <span className="text-[10px] text-base1 dark:text-base01">
          {filteredSnips.length} snip{filteredSnips.length !== 1 ? 's' : ''}
          {filteredSnips.length !== snips.length && ` of ${snips.length} total`}
          {' '}({filteredSnips.filter((s) => s.status === 'solid').length} solid
          {filteredSnips.some((s) => s.status === 'attention') && `, ${filteredSnips.filter((s) => s.status === 'attention').length} attention`})
        </span>
      </div>

      {/* Loop overlay */}
      {loopOpen && (
        <div className={`absolute inset-0 ${Z.overlay} flex flex-col bg-base3 dark:bg-base03`}>
          <div className="flex shrink-0 items-center gap-2 border-b border-base2 bg-base3 px-3 dark:border-base02 dark:bg-base03">
            <Button
              variant="icon"
              onClick={() => setLoopOpen(false)}
              className="shrink-0"
              aria-label="Back to snips"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
            </Button>
            <div className="flex-1" />
            <PomodoroTimer zenMode={false} />
          </div>
          <LoopCarousel
            snips={filteredSnips}
            xp={0}
            onIncrementXp={async () => 0}
            onIncrementXpForSnip={incrementXpForSnip}
            onExit={() => setLoopOpen(false)}
            shuffled={false}
            noXp={true}
            pathMap={pathMap}
            onRename={renameSnip}
            onNavigateToSnip={navigateToSnip}
          />
        </div>
      )}

      {/* View carousel overlay */}
      {viewStartIndex !== null && (
        <div className={`absolute inset-0 ${Z.overlay} flex flex-col bg-base3 dark:bg-base03`}>
          <div className="flex shrink-0 items-center gap-2 border-b border-base2 bg-base3 px-3 dark:border-base02 dark:bg-base03">
            <Button
              variant="icon"
              onClick={() => setViewStartIndex(null)}
              className="shrink-0"
              aria-label="Back to snips"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
            </Button>
            <div className="flex-1" />
            <PomodoroTimer zenMode={false} />
          </div>
          <LoopCarousel
            snips={filteredSnips}
            xp={0}
            onIncrementXp={async () => 0}
            onExit={() => setViewStartIndex(null)}
            shuffled={false}
            viewMode={true}
            initialIndex={viewStartIndex}
            pathMap={pathMap}
            onRename={renameSnip}
            onNavigateToSnip={navigateToSnip}
          />
        </div>
      )}
    </div>
  )
}

// A single context-menu row: token colors, danger tint for destructive actions.
function MenuRow({ danger, onClick, children }: {
  danger?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-base2 dark:hover:bg-base03',
        danger ? 'text-red' : 'text-base01 dark:text-base1',
      )}
    >
      {children}
    </button>
  )
}

// Context menu with actions, tag checkboxes, create-tag input, and status
// section. Positioning + dismiss lifecycle come from the canonical Menu.
function SnipContextMenu({
  point, snip, tagDefs, bulkSnips,
  onView, onExpand, onNavigate, onRename, onDelete, onAddTag, onRemoveTag, onCreateTag, onSetStatus, onClose,
}: {
  point: { x: number; y: number }
  snip: SnipWithDir
  tagDefs: { name: string; color: string }[]
  bulkSnips: SnipWithDir[] | null
  onView: () => void
  onExpand: () => void
  onNavigate: () => void
  onRename: () => void
  onDelete: () => void
  onAddTag: (tag: string) => void
  onRemoveTag: (tag: string) => void
  onCreateTag: (name: string) => void
  onSetStatus: (status: 'open' | 'solid' | 'attention') => void
  onClose: () => void
}) {
  const [newTagName, setNewTagName] = useState('')
  const snipTags = new Set(snip.tags)

  const actions: Array<{ label: string; action: () => void; danger?: boolean }> = [
    { label: 'View', action: onView },
    { label: 'Expand', action: onExpand },
    { label: 'Open in reader', action: onNavigate },
    { label: 'Rename', action: onRename },
    { label: 'Delete', action: onDelete, danger: true },
  ]

  return (
    <Menu point={point} onClose={onClose} className="max-h-[80vh] min-w-[180px] overflow-y-auto">
      {actions.map(({ label, action, danger }) => (
        <MenuRow key={label} danger={danger} onClick={action}>
          {label}
        </MenuRow>
      ))}

      <div className="border-t border-base2 py-1 dark:border-base02">
        <p className="px-3 py-0.5 text-[10px] font-medium uppercase tracking-wider text-base1 dark:text-base00">
          {bulkSnips ? `Tag ${bulkSnips.length} snips` : 'Tags'}
        </p>
        {tagDefs.map((def) => {
          const assigned = snipTags.has(def.name)
          return (
            <label
              key={def.name}
              className="flex cursor-pointer items-center gap-2 px-3 py-1 hover:bg-base2 dark:hover:bg-base03"
            >
              <input
                type="checkbox"
                checked={assigned}
                onChange={() => assigned ? onRemoveTag(def.name) : onAddTag(def.name)}
                className="accent-blue"
              />
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: def.color }} />
              <span className="text-sm text-base01 dark:text-base1">{def.name}</span>
            </label>
          )
        })}
        <div className="px-3 pt-1">
          <Input
            type="text"
            inputSize="sm"
            surface="panel"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const name = newTagName.trim()
                if (name) {
                  onCreateTag(name)
                  setNewTagName('')
                }
              }
              if (e.key !== 'Escape') e.stopPropagation()
            }}
            placeholder="New tag…"
            className="w-full"
          />
        </div>
      </div>

      <div className="border-t border-base2 py-1 dark:border-base02">
        <p className="px-3 py-0.5 text-[10px] font-medium uppercase tracking-wider text-base1 dark:text-base00">
          {bulkSnips ? `Status (${bulkSnips.length})` : 'Status'}
        </p>
        {(['open', 'solid', 'attention'] as const).map((s) => (
          <MenuRow key={s} onClick={() => { onSetStatus(s); onClose() }}>
            <span className={`h-2 w-2 rounded-full ${
              s === 'solid' ? 'bg-green' : s === 'attention' ? 'bg-orange' : 'bg-base1'
            }`} />
            <span className={`${snip.status === s ? 'font-medium text-base02 dark:text-base2' : 'text-base01 dark:text-base1'}`}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </span>
          </MenuRow>
        ))}
      </div>
    </Menu>
  )
}
