import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { mockInvoke, mockInvokeError, resetMockInvoke } from '../../../__mocks__/@tauri-apps/api/core'

vi.mock('@tauri-apps/api/core')

import { useSearch } from '../useSearch'

const sampleMatches = [
  { page: 1, match_index: 0 },
  { page: 1, match_index: 1 },
  { page: 3, match_index: 0 },
  { page: 5, match_index: 0 },
]

beforeEach(() => {
  resetMockInvoke()
})

describe('useSearch', () => {
  it('starts with empty state', () => {
    const { result } = renderHook(() => useSearch('/test.pdf'))
    expect(result.current.query).toBe('')
    expect(result.current.totalMatches).toBe(0)
    expect(result.current.currentIndex).toBe(0)
    expect(result.current.currentMatchPage).toBe(0)
  })

  it('fetches matches when query changes', async () => {
    mockInvoke('search_document', sampleMatches)
    const { result } = renderHook(() => useSearch('/test.pdf'))

    act(() => result.current.setQuery('theorem'))

    await waitFor(() => {
      expect(result.current.totalMatches).toBe(4)
    })
    expect(result.current.currentIndex).toBe(0)
    expect(result.current.currentMatchPage).toBe(1)
  })

  it('nextMatch wraps around', async () => {
    mockInvoke('search_document', sampleMatches)
    const { result } = renderHook(() => useSearch('/test.pdf'))

    act(() => result.current.setQuery('theorem'))

    await waitFor(() => {
      expect(result.current.totalMatches).toBe(4)
    })

    act(() => result.current.nextMatch()) // index 1
    expect(result.current.currentIndex).toBe(1)
    expect(result.current.currentMatchPage).toBe(1)

    act(() => result.current.nextMatch()) // index 2
    expect(result.current.currentIndex).toBe(2)
    expect(result.current.currentMatchPage).toBe(3)

    act(() => result.current.nextMatch()) // index 3
    act(() => result.current.nextMatch()) // wraps to 0
    expect(result.current.currentIndex).toBe(0)
    expect(result.current.currentMatchPage).toBe(1)
  })

  it('prevMatch wraps around', async () => {
    mockInvoke('search_document', sampleMatches)
    const { result } = renderHook(() => useSearch('/test.pdf'))

    act(() => result.current.setQuery('x'))

    await waitFor(() => {
      expect(result.current.totalMatches).toBe(4)
    })

    act(() => result.current.prevMatch()) // wraps to index 3
    expect(result.current.currentIndex).toBe(3)
    expect(result.current.currentMatchPage).toBe(5)
  })

  it('nextMatch/prevMatch are no-ops when no matches', () => {
    mockInvoke('search_document', [])
    const { result } = renderHook(() => useSearch('/test.pdf'))

    act(() => result.current.nextMatch())
    expect(result.current.currentIndex).toBe(0)

    act(() => result.current.prevMatch())
    expect(result.current.currentIndex).toBe(0)
  })

  it('clears matches when query is empty', async () => {
    mockInvoke('search_document', sampleMatches)
    const { result } = renderHook(() => useSearch('/test.pdf'))

    act(() => result.current.setQuery('theorem'))
    await waitFor(() => expect(result.current.totalMatches).toBe(4))

    act(() => result.current.setQuery(''))
    await waitFor(() => expect(result.current.totalMatches).toBe(0))
    expect(result.current.currentMatchPage).toBe(0)
  })

  it('clears matches on search error', async () => {
    mockInvokeError('search_document', 'search failed')
    const { result } = renderHook(() => useSearch('/test.pdf'))

    act(() => result.current.setQuery('bad'))
    await waitFor(() => expect(result.current.totalMatches).toBe(0))
    expect(result.current.currentMatchPage).toBe(0)
  })

  it('does not search when fullPath is undefined', () => {
    mockInvoke('search_document', sampleMatches)
    const { result } = renderHook(() => useSearch(undefined))

    act(() => result.current.setQuery('theorem'))
    expect(result.current.totalMatches).toBe(0)
  })
})
