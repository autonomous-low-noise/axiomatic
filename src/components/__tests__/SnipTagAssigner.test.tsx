import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { SnipTagAssigner } from '../SnipTagAssigner'
import type { SnipTagDef } from '../../hooks/useSnipTagDefs'
import type { SnipWithDir } from '../../hooks/useSnips'

const DEFS: SnipTagDef[] = [
  { name: 'lemma', color: '#268bd2' },
  { name: 'proof', color: '#859900' },
  { name: 'todo', color: '#dc322f' },
]

function makeSnip(id: string, dirPath: string, tags: string[]): SnipWithDir {
  return {
    id,
    slug: 'book',
    full_path: `${dirPath}/book.pdf`,
    page: 1,
    label: `snip ${id}`,
    x: 0,
    y: 0,
    width: 0.5,
    height: 0.5,
    created_at: '2026-01-01T00:00:00Z',
    tags,
    status: 'open',
    dirPath,
    dirLabel: dirPath,
  }
}

// s1/s2 live in /lib-a, s3 in /lib-b.
// 'lemma' → on all three; 'proof' → only on s1 (some); 'todo' → on none.
const SNIPS: SnipWithDir[] = [
  makeSnip('s1', '/lib-a', ['lemma', 'proof']),
  makeSnip('s2', '/lib-a', ['lemma']),
  makeSnip('s3', '/lib-b', ['lemma']),
]

function renderAssigner(overrides: Partial<Parameters<typeof SnipTagAssigner>[0]> = {}) {
  const props = {
    defs: DEFS,
    selectedSnips: SNIPS,
    onBulkAdd: vi.fn(),
    onBulkRemove: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  }
  const result = render(<SnipTagAssigner {...props} />)
  return { props, ...result }
}

describe('SnipTagAssigner', () => {
  it('renders the panel title and selection count (plural)', () => {
    renderAssigner()
    expect(screen.getByText('Assign Tags')).toBeInTheDocument()
    expect(screen.getByText('3 snips selected')).toBeInTheDocument()
  })

  it('uses singular wording for a single selected snip', () => {
    renderAssigner({ selectedSnips: [SNIPS[0]] })
    expect(screen.getByText('1 snip selected')).toBeInTheDocument()
  })

  it('checkboxes reflect all/some/none assignment states', () => {
    renderAssigner()
    const all = screen.getByRole('checkbox', { name: /lemma/ }) as HTMLInputElement
    const some = screen.getByRole('checkbox', { name: /proof/ }) as HTMLInputElement
    const none = screen.getByRole('checkbox', { name: /todo/ }) as HTMLInputElement
    expect(all.checked).toBe(true)
    expect(all.indeterminate).toBe(false)
    expect(some.checked).toBe(false)
    expect(some.indeterminate).toBe(true)
    expect(none.checked).toBe(false)
    expect(none.indeterminate).toBe(false)
  })

  it('toggling an unassigned tag bulk-adds it, grouped per directory', () => {
    const { props } = renderAssigner()
    fireEvent.click(screen.getByRole('checkbox', { name: /todo/ }))
    expect(props.onBulkAdd).toHaveBeenCalledTimes(2)
    expect(props.onBulkAdd).toHaveBeenCalledWith('/lib-a', ['s1', 's2'], 'todo')
    expect(props.onBulkAdd).toHaveBeenCalledWith('/lib-b', ['s3'], 'todo')
    expect(props.onBulkRemove).not.toHaveBeenCalled()
  })

  it('toggling a partially-assigned tag bulk-adds it to all snips', () => {
    const { props } = renderAssigner()
    fireEvent.click(screen.getByRole('checkbox', { name: /proof/ }))
    expect(props.onBulkAdd).toHaveBeenCalledWith('/lib-a', ['s1', 's2'], 'proof')
    expect(props.onBulkAdd).toHaveBeenCalledWith('/lib-b', ['s3'], 'proof')
    expect(props.onBulkRemove).not.toHaveBeenCalled()
  })

  it('toggling a fully-assigned tag bulk-removes it, grouped per directory', () => {
    const { props } = renderAssigner()
    fireEvent.click(screen.getByRole('checkbox', { name: /lemma/ }))
    expect(props.onBulkRemove).toHaveBeenCalledTimes(2)
    expect(props.onBulkRemove).toHaveBeenCalledWith('/lib-a', ['s1', 's2'], 'lemma')
    expect(props.onBulkRemove).toHaveBeenCalledWith('/lib-b', ['s3'], 'lemma')
    expect(props.onBulkAdd).not.toHaveBeenCalled()
  })

  it('shows the empty state when no tag defs exist', () => {
    renderAssigner({ defs: [] })
    expect(screen.getByText('No snip tags created yet.')).toBeInTheDocument()
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
  })

  it('Escape calls onClose', () => {
    const { props } = renderAssigner()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('the close button calls onClose', () => {
    const { props } = renderAssigner()
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })
})
