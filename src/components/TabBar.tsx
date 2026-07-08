import { useState, useRef, useCallback } from 'react'
import type { OpenTab } from '../hooks/useTabs'
import { ContextMenu, type MenuItem } from './ContextMenu'

interface Props {
  tabs: OpenTab[]
  activeSlug: string | null
  onSelect: (slug: string) => void
  onClose: (slug: string) => void
  onCloseOthers: (slug: string) => void
  onCloseToLeft?: (slug: string) => void
  onCloseToRight?: (slug: string) => void
}

interface TabMenuState {
  x: number
  y: number
  slug: string
}

export function TabBar({ tabs, activeSlug, onSelect, onClose, onCloseOthers, onCloseToLeft, onCloseToRight }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [menu, setMenu] = useState<TabMenuState | null>(null)

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!scrollRef.current) return
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault()
      scrollRef.current.scrollLeft += e.deltaY
    }
  }, [])

  const handleContextMenu = useCallback((e: React.MouseEvent, slug: string) => {
    e.preventDefault()
    setMenu({ x: e.clientX, y: e.clientY, slug })
  }, [])

  if (tabs.length === 0) return null

  const menuItems: MenuItem[] = menu
    ? [
        { label: 'Close', action: () => onClose(menu.slug) },
        { label: 'Close Others', action: () => onCloseOthers(menu.slug) },
        ...(onCloseToLeft && tabs.findIndex((t) => t.slug === menu.slug) > 0
          ? [{ label: 'Close to the Left', action: () => onCloseToLeft(menu.slug) }]
          : []),
        ...(onCloseToRight && tabs.findIndex((t) => t.slug === menu.slug) < tabs.length - 1
          ? [{ label: 'Close to the Right', action: () => onCloseToRight(menu.slug) }]
          : []),
      ]
    : []

  return (
    <>
      <div
        ref={scrollRef}
        onWheel={handleWheel}
        className="flex shrink-0 overflow-hidden bg-base3 dark:bg-base03"
      >
        {tabs.map((tab) => {
          const isActive = tab.slug === activeSlug
          return (
            <div
              key={tab.slug}
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelect(tab.slug)}
              onContextMenu={(e) => handleContextMenu(e, tab.slug)}
              className={`group relative flex min-w-[100px] max-w-[180px] shrink-0 cursor-pointer items-center border-r border-base2 dark:border-base02 ${
                isActive
                  ? 'bg-base2/50 dark:bg-base02/50'
                  : 'hover:bg-base2/30 dark:hover:bg-base02/30'
              }`}
            >
              {isActive && (
                <span className="absolute inset-x-0 top-0 h-[2px] bg-blue" />
              )}
              <span
                className={`min-w-0 flex-1 truncate py-1.5 pl-3 pr-1 text-xs ${
                  isActive
                    ? 'text-base02 dark:text-base2'
                    : 'text-base1 dark:text-base00'
                }`}
              >
                {tab.title}
              </span>
              <span
                role="button"
                tabIndex={0}
                aria-label={`Close ${tab.title}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onClose(tab.slug)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.stopPropagation()
                    onClose(tab.slug)
                  }
                }}
                className={`mr-1.5 shrink-0 rounded p-1 ${
                  isActive
                    ? 'text-base1 hover:bg-base1/20 hover:text-base01 dark:text-base00 dark:hover:text-base1'
                    : 'text-transparent hover:bg-base1/20 hover:text-base1 group-hover:text-base1/40 dark:hover:text-base00 dark:group-hover:text-base00/40'
                }`}
              >
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </span>
            </div>
          )
        })}
      </div>

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} />
      )}
    </>
  )
}
