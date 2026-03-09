import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Mock the IPC layer before importing the hook
const getNoteMock = vi.fn().mockResolvedValue({ content: 'fetched note', format: 'markdown' })
vi.mock('../../lib/notes', () => ({
  getNote: (...args: unknown[]) => getNoteMock(...args),
  setNote: vi.fn().mockResolvedValue(undefined),
}))

// useNotes uses module-level state (cache, snapshot, listeners).
// We must reset between tests by re-importing.
let useNotes: typeof import('../useNotes').useNotes
let useNoteContent: typeof import('../useNotes').useNoteContent

beforeEach(async () => {
  vi.resetModules()
  getNoteMock.mockReset()
  getNoteMock.mockResolvedValue({ content: 'fetched note', format: 'markdown' })
  const mod = await import('../useNotes')
  useNotes = mod.useNotes
  useNoteContent = mod.useNoteContent
})

describe('useNoteContent', () => {
  it('returns undefined for uncached notes', () => {
    const { result } = renderHook(() => useNoteContent('book', 1))
    expect(result.current).toBeUndefined()
  })

  it('returns content after ensureNote fetch resolves', async () => {
    const { result: notes } = renderHook(() => useNotes())
    const { result: content } = renderHook(() => useNoteContent('book', 1))

    expect(content.current).toBeUndefined()

    act(() => { notes.current.ensureNote('book', 1) })
    await act(async () => { await new Promise((r) => setTimeout(r, 20)) })

    expect(content.current).toBe('fetched note')
  })

  it('setNote optimistically updates content', () => {
    const { result: notes } = renderHook(() => useNotes())
    const { result: content } = renderHook(() => useNoteContent('book', 1))

    act(() => { notes.current.setNote('book', 1, 'new content') })

    expect(content.current).toBe('new content')
  })

  it('returns different content after page changes and ensureNote resolves', async () => {
    getNoteMock.mockImplementation(async (_slug: string, page: number) => ({
      content: `page ${page} notes`, format: 'markdown'
    }))
    const { result: hooks } = renderHook(() => useNotes())
    const { result: c1 } = renderHook(() => useNoteContent('book', 1))

    act(() => { hooks.current.ensureNote('book', 1) })
    await act(async () => { await new Promise((r) => setTimeout(r, 20)) })
    expect(c1.current).toBe('page 1 notes')

    const { result: c2 } = renderHook(() => useNoteContent('book', 2))
    expect(c2.current).toBeUndefined()

    act(() => { hooks.current.ensureNote('book', 2) })
    await act(async () => { await new Promise((r) => setTimeout(r, 20)) })
    expect(c2.current).toBe('page 2 notes')
  })
})

describe('useNotes callback stability', () => {
  it('ensureNote identity is stable after fetch', async () => {
    const { result } = renderHook(() => useNotes())
    const initial = result.current.ensureNote

    act(() => { result.current.ensureNote('book', 1) })
    await act(async () => { await new Promise((r) => setTimeout(r, 20)) })

    expect(result.current.ensureNote).toBe(initial)
  })

  it('setNote identity is stable after fetch', async () => {
    const { result } = renderHook(() => useNotes())
    const initial = result.current.setNote

    act(() => { result.current.ensureNote('book', 1) })
    await act(async () => { await new Promise((r) => setTimeout(r, 20)) })

    expect(result.current.setNote).toBe(initial)
  })
})
