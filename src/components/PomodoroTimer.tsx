import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  usePomodoroConfig,
  savePomodoroConfig,
  applyPreset,
  type PomodoroPreset,
  type PomodoroConfig,
} from '../hooks/usePomodoroConfig'
import {
  usePomodoroTimer,
  toggleTimer,
  resetTimer,
  skipPhase,
  dismissOverlay,
  resetToPreset,
  applyNewDuration,
} from '../hooks/usePomodoroTimer'
import { BreakOverlay } from './BreakOverlay'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Menu } from './ui/Menu'

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

interface Props {
  zenMode: boolean
  activeSlug?: string
  activeDirPath?: string
}

export function PomodoroTimer({ zenMode, activeSlug, activeDirPath }: Props) {
  const config = usePomodoroConfig()
  const timer = usePomodoroTimer(activeSlug, activeDirPath)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [customWork, setCustomWork] = useState(String(config.workMinutes))
  const [customBreak, setCustomBreak] = useState(String(config.breakMinutes))
  const settingsBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- intentional: sync derived state with config changes */
    setCustomWork(String(config.workMinutes))
    setCustomBreak(String(config.breakMinutes))
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [config.workMinutes, config.breakMinutes])

  useEffect(() => {
    applyNewDuration(config.workMinutes)
  }, [config.workMinutes])

  const handlePresetChange = useCallback(
    (preset: PomodoroPreset) => {
      const next = applyPreset(preset, config)
      savePomodoroConfig(next)
      resetToPreset(next.workMinutes)
    },
    [config],
  )

  const handleCustomApply = useCallback(() => {
    const w = parseInt(customWork, 10)
    const b = parseInt(customBreak, 10)
    if (!w || w < 1 || !b || b < 1) return
    const next: PomodoroConfig = { ...config, preset: 'custom', workMinutes: w, breakMinutes: b }
    savePomodoroConfig(next)
    resetToPreset(w)
  }, [config, customWork, customBreak])

  const handleToggleAudio = useCallback(() => {
    savePomodoroConfig({ ...config, audioEnabled: !config.audioEnabled })
  }, [config])

  const breakDuration = timer.isLongBreak
    ? config.breakMinutes * config.longBreakMultiplier
    : config.breakMinutes

  const phaseColor =
    timer.phase === 'work'
      ? 'text-green dark:text-green'
      : 'text-blue dark:text-blue'

  return (
    <>
      <div style={zenMode ? { display: 'none' } : undefined} className="flex items-center gap-1">
        <div className="mx-0.5 h-4 w-px bg-base2 dark:bg-base02" />
        {config.longBreakInterval > 0 && (
          <span className="mr-0.5 text-xs tabular-nums text-base1 dark:text-base01">
            {timer.completedPomodoros}/{config.longBreakInterval}
          </span>
        )}
        <button
          onClick={toggleTimer}
          className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-sm tabular-nums hover:bg-base2 dark:hover:bg-base02 ${phaseColor}`}
          aria-label={timer.running ? 'Pause timer' : 'Start timer'}
        >
          {timer.running ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          )}
          <span>{formatTime(timer.secondsLeft)}</span>
          {(timer.running || timer.phase === 'break') && (
            <span className="text-[10px] uppercase tracking-wide opacity-40">
              {timer.phase === 'work' ? 'work' : 'break'}
            </span>
          )}
        </button>
        <Button
          ref={settingsBtnRef}
          variant="icon"
          size="sm"
          onClick={() => setPopoverOpen((o) => !o)}
          className="shrink-0"
          aria-label="Timer settings"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2h12M6 22h12M7 2v4l5 6-5 6v4M17 2v4l-5 6 5 6v4" />
          </svg>
        </Button>
        {popoverOpen && (
          <Menu anchorRef={settingsBtnRef} onClose={() => setPopoverOpen(false)} className="w-64">
            <div className="px-3 py-2">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-base1 dark:text-base00">
              Duration
            </div>
            <div className="mb-3 flex gap-1">
              {(['45/10', '60/10', '90/15'] as PomodoroPreset[]).map((p) => (
                <Button
                  key={p}
                  variant={config.preset === p ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => handlePresetChange(p)}
                >
                  {p}
                </Button>
              ))}
              <Button
                variant={config.preset === 'custom' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => handlePresetChange('custom')}
              >
                Custom
              </Button>
            </div>
            {config.preset === 'custom' && (
              <div className="mb-3 flex items-center gap-2">
                <label className="flex items-center gap-1 text-xs text-base01 dark:text-base1">
                  <span>Work</span>
                  <Input
                    type="number"
                    min="1"
                    max="120"
                    value={customWork}
                    onChange={(e) => setCustomWork(e.target.value)}
                    inputSize="sm"
                    surface="panel"
                    className="w-12 text-center"
                  />
                </label>
                <label className="flex items-center gap-1 text-xs text-base01 dark:text-base1">
                  <span>Break</span>
                  <Input
                    type="number"
                    min="1"
                    max="60"
                    value={customBreak}
                    onChange={(e) => setCustomBreak(e.target.value)}
                    inputSize="sm"
                    surface="panel"
                    className="w-12 text-center"
                  />
                </label>
                <Button variant="primary" size="sm" onClick={handleCustomApply}>
                  Set
                </Button>
              </div>
            )}
            <div className="mb-2 border-t border-base2 pt-2 dark:border-base02">
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-base1 dark:text-base00">
                Notifications
              </div>
              <div className="flex cursor-pointer items-center justify-between text-xs text-base01 dark:text-base1">
                <span>Audio chime</span>
                <button
                  onClick={handleToggleAudio}
                  className={`shrink-0 relative h-5 w-9 rounded-full transition-colors ${
                    config.audioEnabled
                      ? 'bg-blue'
                      : 'bg-base1/30 dark:bg-base01/40'
                  }`}
                  role="switch"
                  aria-checked={config.audioEnabled}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                      config.audioEnabled ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>
            <div className="border-t border-base2 pt-2 dark:border-base02">
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-base1 dark:text-base00">
                Timer
              </div>
              <div className="flex gap-1">
                <button
                  onClick={skipPhase}
                  className="flex-1 rounded px-2 py-1 text-xs text-base01 hover:bg-base2 dark:text-base1 dark:hover:bg-base02"
                >
                  Skip
                </button>
                <button
                  onClick={resetTimer}
                  className="flex-1 rounded px-2 py-1 text-xs text-red hover:bg-red/10"
                >
                  Reset
                </button>
              </div>
            </div>
            </div>
          </Menu>
        )}
      </div>
      {timer.showOverlay &&
        createPortal(
          <BreakOverlay
            isLongBreak={timer.isLongBreak}
            breakMinutes={breakDuration}
            onDismiss={dismissOverlay}
          />,
          document.body,
        )}
    </>
  )
}
