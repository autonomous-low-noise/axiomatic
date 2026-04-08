import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('../../hooks/useTextbooks', () => ({
  useTextbooks: () => ({
    textbooks: [
      { slug: 'algebra', title: 'Linear Algebra', file: 'algebra.pdf', dir_id: 1, dir_path: '/lib', full_path: '/lib/algebra.pdf' },
    ],
    loading: false,
  }),
}))

vi.mock('../../hooks/useSnips', () => ({
  useSnips: () => ({
    snips: [{ id: 's1', slug: 'algebra', full_path: '/lib/algebra.pdf', page: 1, label: 'Def 1', x: 0, y: 0, width: 0.5, height: 0.5, created_at: '2024-01-01', tags: [], status: 'open' }],
    xp: 0,
    incrementXp: vi.fn().mockResolvedValue(1),
    renameSnip: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('../../hooks/useTabs', () => ({
  useTabNavigation: () => ({
    tabs: [],
    openTab: vi.fn(),
    closeTabAndNavigate: vi.fn(),
    closeOtherTabsAndNavigate: vi.fn(),
    selectTab: vi.fn(),
  }),
}))

vi.mock('../../components/LoopCarousel', () => ({
  LoopCarousel: () => <div data-testid="loop-carousel" />,
}))

vi.mock('../../components/TabBar', () => ({
  TabBar: () => <div data-testid="tab-bar" />,
}))

vi.mock('../../components/PomodoroTimer', () => ({
  PomodoroTimer: (props: { activeSlug?: string }) => (
    <div data-testid="pomodoro-timer" data-slug={props.activeSlug} />
  ),
}))

import { LoopPage } from '../LoopPage'

function renderPage(slug = 'algebra', mode = 'sorted') {
  return render(
    <MemoryRouter initialEntries={[`/loop/${slug}?mode=${mode}`]}>
      <Routes>
        <Route path="/loop/:slug" element={<LoopPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('LoopPage', () => {
  it('renders PomodoroTimer with activeSlug', () => {
    renderPage()
    const timer = screen.getByTestId('pomodoro-timer')
    expect(timer).toBeInTheDocument()
    expect(timer).toHaveAttribute('data-slug', 'algebra')
  })
})
