import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { mockInvoke, resetMockInvoke, getInvokeCallsFor } from '../../../__mocks__/@tauri-apps/api/core'

vi.mock('@tauri-apps/api/core')

import { useSnips, useAllSnips } from '../useSnips'
import type { Snip } from '../useSnips'

const sampleSnip: Snip = {
  id: 'snip-1',
  slug: 'test_book',
  full_path: '/dir/test_book.pdf',
  page: 3,
  label: 'Theorem 2.1',
  x: 0.1,
  y: 0.2,
  width: 0.5,
  height: 0.3,
  created_at: '2024-01-01T00:00:00Z',
  tags: [],
}

beforeEach(() => {
  resetMockInvoke()
})

describe('useSnips', () => {
  it('loads snips and XP on mount', async () => {
    mockInvoke('list_snips', [sampleSnip])
    mockInvoke('get_xp', 5)

    const { result } = renderHook(() => useSnips('test_book', '/dir'))

    await waitFor(() => {
      expect(result.current.snips.length).toBe(1)
    })

    expect(result.current.snips[0].label).toBe('Theorem 2.1')
    expect(result.current.xp).toBe(5)

    const listCalls = getInvokeCallsFor('list_snips')
    expect(listCalls.length).toBe(1)
    expect(listCalls[0].args?.slug).toBe('test_book')
    expect(listCalls[0].args?.dirPath).toBe('/dir')
  })

  it('addSnip calls create_snip and appends to local state', async () => {
    mockInvoke('list_snips', [])
    mockInvoke('get_xp', 0)

    const createdSnip: Snip = {
      ...sampleSnip,
      id: 'snip-new',
      label: 'New Snip',
    }
    mockInvoke('create_snip', createdSnip)

    const { result } = renderHook(() => useSnips('test_book', '/dir'))

    await waitFor(() => {
      expect(result.current.snips).toBeDefined()
    })

    await act(async () => {
      await result.current.addSnip('/dir/test_book.pdf', 3, 'New Snip', 0.1, 0.2, 0.5, 0.3)
    })

    expect(result.current.snips.length).toBe(1)
    expect(result.current.snips[0].id).toBe('snip-new')

    const createCalls = getInvokeCallsFor('create_snip')
    expect(createCalls.length).toBe(1)
    expect(createCalls[0].args?.label).toBe('New Snip')
    expect(createCalls[0].args?.page).toBe(3)
  })

  it('removeSnip calls delete_snip and removes from local state', async () => {
    mockInvoke('list_snips', [sampleSnip])
    mockInvoke('get_xp', 0)
    mockInvoke('delete_snip', null)

    const { result } = renderHook(() => useSnips('test_book', '/dir'))

    await waitFor(() => {
      expect(result.current.snips.length).toBe(1)
    })

    await act(async () => {
      await result.current.removeSnip('snip-1')
    })

    expect(result.current.snips.length).toBe(0)

    const deleteCalls = getInvokeCallsFor('delete_snip')
    expect(deleteCalls.length).toBe(1)
    expect(deleteCalls[0].args?.id).toBe('snip-1')
  })

  it('incrementXp calls increment_xp and updates local XP', async () => {
    mockInvoke('list_snips', [])
    mockInvoke('get_xp', 0)
    mockInvoke('increment_xp', 1)

    const { result } = renderHook(() => useSnips('test_book', '/dir'))

    await waitFor(() => {
      expect(result.current.xp).toBe(0)
    })

    let returnedXp: number | undefined
    await act(async () => {
      returnedXp = await result.current.incrementXp()
    })

    expect(returnedXp).toBe(1)
    expect(result.current.xp).toBe(1)

    const xpCalls = getInvokeCallsFor('increment_xp')
    expect(xpCalls.length).toBe(1)
    expect(xpCalls[0].args?.slug).toBe('test_book')
  })

  it('does not load when slug or dirPath is undefined', () => {
    const { result } = renderHook(() => useSnips(undefined, undefined))
    expect(result.current.snips).toEqual([])
    expect(result.current.xp).toBe(0)
    expect(getInvokeCallsFor('list_snips').length).toBe(0)
  })
})

describe('useAllSnips', () => {
  const dir1 = { path: '/lib1', label: 'Library 1' }
  const dir2 = { path: '/lib2', label: 'Library 2' }

  const snipA: Snip = { ...sampleSnip, id: 'a', slug: 'book_a', tags: ['math'] }
  const snipB: Snip = { ...sampleSnip, id: 'b', slug: 'book_b', tags: [] }

  it('loads snips from all directories', async () => {
    mockInvoke('list_all_snips', (args: Record<string, unknown>) =>
      args.dirPath === '/lib1' ? [snipA] : [snipB],
    )
    // Use useMemo-stable reference via initialProps
    const dirs = [dir1, dir2]
    const { result } = renderHook(({ d }) => useAllSnips(d), { initialProps: { d: dirs } })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.snips).toHaveLength(2)
    expect(result.current.snips[0].dirPath).toBe('/lib1')
    expect(result.current.snips[1].dirPath).toBe('/lib2')
  })

  it('addTag calls IPC and updates local state (deduplicates)', async () => {
    mockInvoke('list_all_snips', [snipA])
    mockInvoke('add_snip_tag', null)
    const dirs = [dir1]
    const { result } = renderHook(({ d }) => useAllSnips(d), { initialProps: { d: dirs } })

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.addTag('/lib1', 'a', 'algebra')
    })
    expect(result.current.snips[0].tags).toEqual(['math', 'algebra'])

    // Duplicate tag should not be added
    await act(async () => {
      await result.current.addTag('/lib1', 'a', 'math')
    })
    expect(result.current.snips[0].tags).toEqual(['math', 'algebra'])
  })

  it('removeTag calls IPC and filters tag from local state', async () => {
    mockInvoke('list_all_snips', [{ ...snipA, tags: ['math', 'algebra'] }])
    mockInvoke('remove_snip_tag', null)
    const dirs = [dir1]
    const { result } = renderHook(({ d }) => useAllSnips(d), { initialProps: { d: dirs } })

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.removeTag('/lib1', 'a', 'math')
    })
    expect(result.current.snips[0].tags).toEqual(['algebra'])
  })

  it('returns empty snips when directories is empty', async () => {
    const empty: typeof dir1[] = []
    const { result } = renderHook(({ d }) => useAllSnips(d), { initialProps: { d: empty } })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.snips).toEqual([])
  })
})
