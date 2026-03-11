import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Titlebar } from './Titlebar'
import { CommandPalette } from './CommandPalette'
import { useTheme } from '../hooks/useTheme'
import { registerPaletteToggle } from '../lib/palette'
import { buildCommands } from '../lib/commands'

export function Layout() {
  const [isLinux, setIsLinux] = useState<boolean | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const location = useLocation()
  const { theme } = useTheme()
  const navigate = useNavigate()
  const isReader = location.pathname.startsWith('/read/')
  const isOverview = location.pathname === '/'

  useEffect(() => {
    invoke<string>('get_platform').then((p) => setIsLinux(p === 'linux'))
  }, [])

  // Register the module-level toggle; Ctrl+P shortcut
  useEffect(() => {
    const unregister = registerPaletteToggle(() => setPaletteOpen((o) => !o))
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      unregister()
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const closePalette = useCallback(() => setPaletteOpen(false), [])

  const commands = useMemo(() => buildCommands({ isReader, isOverview, theme, navigate }), [isReader, isOverview, theme, navigate])

  // Avoid flash — render nothing until platform is known
  if (isLinux === null) return null

  const palette = paletteOpen && (
    <CommandPalette commands={commands} onClose={closePalette} />
  )

  if (isLinux) {
    return (
      <div className="flex h-screen flex-col bg-[#fdf6e3] dark:bg-[#002b36]">
        {palette}
        <div className="flex min-h-0 flex-1 flex-col">
          <Outlet />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col p-2">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg bg-[#fdf6e3] shadow-[0_1px_12px_rgba(0,0,0,0.2)] dark:bg-[#002b36] dark:shadow-[0_1px_12px_rgba(0,0,0,0.55)]">
        <Titlebar />
        {palette}
        <div className="flex min-h-0 flex-1 flex-col">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
