import { Button } from './ui/Button'
import { Z } from '../lib/zIndex'

interface Props {
  isLongBreak: boolean
  breakMinutes: number
  onDismiss: () => void
}

export function BreakOverlay({ isLongBreak, breakMinutes, onDismiss }: Props) {
  return (
    <div className={`fixed inset-0 ${Z.modal} flex items-center justify-center bg-base03/80 dark:bg-base03/90`}>
      <div className="flex flex-col items-center gap-6 rounded-2xl bg-base3 px-12 py-10 shadow-2xl dark:bg-base02">
        <div className="text-4xl text-blue">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
            <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
            <line x1="6" y1="2" x2="6" y2="4" />
            <line x1="10" y1="2" x2="10" y2="4" />
            <line x1="14" y1="2" x2="14" y2="4" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-base01 dark:text-base1">
          {isLongBreak ? 'Long break' : 'Take a break'}
        </h2>
        <p className="text-sm text-base00 dark:text-base0">
          {breakMinutes} minute{breakMinutes !== 1 ? 's' : ''} {isLongBreak ? 'long break' : 'break'} starting now
        </p>
        <Button variant="primary" size="lg" onClick={onDismiss} autoFocus>
          Dismiss
        </Button>
      </div>
    </div>
  )
}
