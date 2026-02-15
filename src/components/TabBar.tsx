import type { OpenTab } from '../hooks/useTabs'

interface Props {
  tabs: OpenTab[]
  activeSlug: string | null
  onSelect: (slug: string) => void
  onClose: (slug: string) => void
}

export function TabBar({ tabs, activeSlug, onSelect, onClose }: Props) {
  if (tabs.length <= 1) return null

  return (
    <div className="flex h-9 shrink-0 items-end gap-1 overflow-x-auto border-b border-[#eee8d5] bg-[#fdf6e3] px-2 dark:border-[#073642] dark:bg-[#002b36]">
      {tabs.map((tab) => {
        const isActive = tab.slug === activeSlug
        return (
          <button
            key={tab.slug}
            onClick={() => onSelect(tab.slug)}
            className={`group flex max-w-[220px] items-center gap-1.5 rounded-t border border-b-0 px-3.5 py-1.5 text-xs font-medium transition-colors ${
              isActive
                ? 'border-[#eee8d5] bg-[#eee8d5] text-[#073642] dark:border-[#073642] dark:bg-[#073642] dark:text-[#eee8d5]'
                : 'border-transparent text-[#93a1a1] hover:border-[#eee8d5]/60 hover:bg-[#eee8d5]/50 hover:text-[#586e75] dark:text-[#657b83] dark:hover:border-[#073642]/60 dark:hover:bg-[#073642]/50 dark:hover:text-[#93a1a1]'
            }`}
          >
            <span className="min-w-0 truncate">{tab.title}</span>
            <span
              role="button"
              aria-label={`Close ${tab.title}`}
              onClick={(e) => {
                e.stopPropagation()
                onClose(tab.slug)
              }}
              className="shrink-0 rounded p-0.5 opacity-0 hover:bg-[#93a1a1]/20 group-hover:opacity-100"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </span>
          </button>
        )
      })}
    </div>
  )
}
