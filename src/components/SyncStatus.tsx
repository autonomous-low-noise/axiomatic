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
    <div className="w-16 h-1 rounded-full bg-base2 dark:bg-base02">
      <div
        className="h-1 rounded-full bg-base1 dark:bg-base01 animate-pulse"
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
    /* eslint-disable react-hooks/set-state-in-effect -- intentional: sync visibility with phase transitions */
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
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [phase])

  if (bookCount === 0 || !visible) return null

  const isDone = phase === 'done'

  return (
    <span
      className={`ml-auto flex items-center gap-1.5 text-xs text-base1 transition-opacity duration-500 dark:text-base01 ${faded ? 'opacity-0' : 'opacity-100'}`}
    >
      {isDone ? <Checkmark /> : <ProgressBar />}
      {label}
    </span>
  )
}
