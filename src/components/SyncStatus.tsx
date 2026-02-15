import { useEffect, useRef, useState } from 'react'
import type { SyncPhase } from '../hooks/useSyncStatus'

interface SyncStatusProps {
  phase: SyncPhase
  label: string
  bookCount: number
}

function Checkmark() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function ProgressBar() {
  return (
    <div className="w-16 h-1 rounded-full bg-[#eee8d5] dark:bg-[#073642]">
      <div
        className="h-1 rounded-full bg-[#93a1a1] dark:bg-[#586e75] animate-pulse"
        style={{ width: '30%' }}
      />
    </div>
  )
}

export function SyncStatus({ phase, label, bookCount }: SyncStatusProps) {
  const [visible, setVisible] = useState(true)
  const [faded, setFaded] = useState(false)
  const fadeTimer = useRef<ReturnType<typeof setTimeout>>(null)
  const unmountTimer = useRef<ReturnType<typeof setTimeout>>(null)

  useEffect(() => {
    if (fadeTimer.current) clearTimeout(fadeTimer.current)
    if (unmountTimer.current) clearTimeout(unmountTimer.current)

    if (phase === 'done') {
      setVisible(true)
      setFaded(false)
      fadeTimer.current = setTimeout(() => setFaded(true), 2000)
      unmountTimer.current = setTimeout(() => setVisible(false), 2500)
    } else {
      setVisible(true)
      setFaded(false)
    }

    return () => {
      if (fadeTimer.current) clearTimeout(fadeTimer.current)
      if (unmountTimer.current) clearTimeout(unmountTimer.current)
    }
  }, [phase])

  if (bookCount === 0 || !visible) return null

  const isDone = phase === 'done'

  return (
    <span
      className={`ml-auto flex items-center gap-1.5 text-xs text-[#93a1a1] transition-opacity duration-500 dark:text-[#586e75] ${faded ? 'opacity-0' : 'opacity-100'}`}
    >
      {isDone ? <Checkmark /> : <ProgressBar />}
      {label}
    </span>
  )
}
