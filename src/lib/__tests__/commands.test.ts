import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../hooks/useTheme', () => ({ setTheme: vi.fn() }))

import { setTheme } from '../../hooks/useTheme'
import { buildCommands } from '../commands'

const mockedSetTheme = vi.mocked(setTheme)
const noop = () => {}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('buildCommands', () => {
  it('returns theme commands on non-reader pages', () => {
    const cmds = buildCommands({ isReader: false, isOverview: false, theme: 'light', navigate: noop })
    const ids = cmds.map((c) => c.id)
    expect(ids).toContain('theme-system')
    expect(ids).toContain('theme-toggle')
    expect(ids).not.toContain('toggle-outline')
    expect(ids).not.toContain('toggle-learning-tools')
  })

  it('includes reader commands including toggle-learning-tools', () => {
    const cmds = buildCommands({ isReader: true, isOverview: false, theme: 'dark', navigate: noop })
    const ids = cmds.map((c) => c.id)
    expect(ids).toContain('toggle-outline')
    expect(ids).toContain('toggle-notes')
    expect(ids).toContain('toggle-bookmarks')
    expect(ids).toContain('toggle-highlights')
    expect(ids).toContain('toggle-zen')
    expect(ids).toContain('toggle-learning-tools')
  })

  it('does not include per-tool commands (snip, loop, pomodoro)', () => {
    const cmds = buildCommands({ isReader: true, isOverview: false, theme: 'light', navigate: noop })
    const ids = cmds.map((c) => c.id)
    expect(ids).not.toContain('snip')
    expect(ids).not.toContain('stop-snipping')
    expect(ids).not.toContain('loop-sorted')
    expect(ids).not.toContain('loop-shuffled')
    expect(ids).not.toContain('toggle-pomodoro')
  })

  it('includes show-stats on overview page', () => {
    const nav = vi.fn()
    const cmds = buildCommands({ isReader: false, isOverview: true, theme: 'light', navigate: nav })
    const cmd = cmds.find((c) => c.id === 'show-stats')
    expect(cmd).toBeDefined()
    expect(cmd!.label).toBe('Show stats')
    cmd!.action()
    expect(nav).toHaveBeenCalledWith('/stats')
  })

  it('does not include show-stats on non-overview pages', () => {
    const cmds = buildCommands({ isReader: true, isOverview: false, theme: 'light', navigate: noop })
    expect(cmds.map((c) => c.id)).not.toContain('show-stats')
  })

  it('shows correct theme toggle label per mode', () => {
    expect(buildCommands({ isReader: false, isOverview: false, theme: 'dark', navigate: noop }).find((c) => c.id === 'theme-toggle')?.label).toBe('Switch to light mode')
    expect(buildCommands({ isReader: false, isOverview: false, theme: 'light', navigate: noop }).find((c) => c.id === 'theme-toggle')?.label).toBe('Switch to dark mode')
  })

  it('theme-system action calls setTheme("system")', () => {
    const cmds = buildCommands({ isReader: false, isOverview: false, theme: 'light', navigate: noop })
    cmds.find((c) => c.id === 'theme-system')!.action()
    expect(mockedSetTheme).toHaveBeenCalledWith('system')
  })

  it('theme-toggle action toggles theme correctly', () => {
    buildCommands({ isReader: false, isOverview: false, theme: 'dark', navigate: noop }).find((c) => c.id === 'theme-toggle')!.action()
    expect(mockedSetTheme).toHaveBeenCalledWith('light')

    mockedSetTheme.mockClear()
    buildCommands({ isReader: false, isOverview: false, theme: 'light', navigate: noop }).find((c) => c.id === 'theme-toggle')!.action()
    expect(mockedSetTheme).toHaveBeenCalledWith('dark')
  })

  it('reader commands dispatch CustomEvents on window', () => {
    const events: string[] = []
    const listener = (e: Event) => events.push(e.type)

    const eventNames = [
      'axiomatic:toggle-outline',
      'axiomatic:toggle-notes',
      'axiomatic:toggle-bookmarks',
      'axiomatic:toggle-highlights',
      'axiomatic:toggle-zen',
      'axiomatic:toggle-learning-tools',
    ]
    for (const name of eventNames) window.addEventListener(name, listener)

    const cmds = buildCommands({ isReader: true, isOverview: false, theme: 'light', navigate: noop })
    const readerIds = ['toggle-outline', 'toggle-notes', 'toggle-bookmarks', 'toggle-highlights', 'toggle-zen', 'toggle-learning-tools']
    for (const id of readerIds) {
      cmds.find((c) => c.id === id)!.action()
    }

    expect(events).toEqual(eventNames)

    for (const name of eventNames) window.removeEventListener(name, listener)
  })

  it('all commands have non-empty labels', () => {
    const cmds = buildCommands({ isReader: true, isOverview: false, theme: 'dark', navigate: noop })
    for (const cmd of cmds) {
      expect(cmd.label.length).toBeGreaterThan(0)
    }
  })
})
