import { useEffect, useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { Button } from './ui/Button'

const appWindow = getCurrentWindow()

export function Titlebar() {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    appWindow.isMaximized().then(setMaximized)
    const unlisten = appWindow.onResized(() => {
      appWindow.isMaximized().then(setMaximized)
    })
    return () => { unlisten.then((f) => f()) }
  }, [])

  const iconProps = {
    width: 12,
    height: 12,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  return (
    <div
      onMouseDown={(e) => {
        // Only drag on the bar itself, not on buttons
        if ((e.target as HTMLElement).closest('button')) return
        e.preventDefault()
        appWindow.startDragging()
      }}
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest('button')) return
        appWindow.toggleMaximize()
      }}
      className="flex h-9 shrink-0 select-none items-center justify-between border-b border-base2 bg-base3 px-3 dark:border-base02 dark:bg-base03"
    >
      <div className="flex items-center gap-2 pointer-events-none">
        <img src="/Logo_light-02-01-scaled.svg" alt="" className="h-4 w-4" />
        <span className="text-xs font-semibold text-base01 dark:text-base1">
          Axiomatic
        </span>
      </div>
      <div className="flex items-center gap-0.5">
        <Button
          variant="icon"
          size="sm"
          onClick={() => appWindow.minimize()}
          aria-label="Minimize"
        >
          <svg {...iconProps}>
            <path d="M4 12L12 12" />
          </svg>
        </Button>
        <Button
          variant="icon"
          size="sm"
          onClick={() => appWindow.toggleMaximize()}
          aria-label={maximized ? 'Restore' : 'Maximize'}
        >
          <svg {...iconProps}>
            {maximized ? (
              <rect x="4" y="4" width="8" height="8" rx="2" />
            ) : (
              <rect x="2" y="2" width="12" height="12" rx="2" />
            )}
          </svg>
        </Button>
        <Button
          variant="icon"
          size="sm"
          onClick={() => appWindow.close()}
          className="hover:bg-red hover:text-white dark:hover:bg-red dark:hover:text-base2"
          aria-label="Close"
        >
          <svg {...iconProps}>
            <path d="M5 11L11 5M5 5L11 11" />
          </svg>
        </Button>
      </div>
    </div>
  )
}
