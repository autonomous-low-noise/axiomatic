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
  const popoverRef = useRef<HTMLDivElement>(null)
  const settingsBtnRef = useRef<HTMLButtonElement>(null)
  const [popoverPos, setPopoverPos] = useState<{ top: number; right: number }>({ top: 40, right: 8 })

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- intentional: sync derived state with config changes */
    setCustomWork(String(config.workMinutes))
    setCustomBreak(String(config.breakMinutes))
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [config.workMinutes, config.breakMinutes])

  useEffect(() => {
    applyNewDuration(config.workMinutes)
  }, [config.workMinutes])

  useEffect(() => {
    if (!popoverOpen) return
    const r = settingsBtnRef.current?.getBoundingClientRect()
    if (r) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: compute position on popover open
      setPopoverPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
    }
  }, [popoverOpen])

  useEffect(() => {
    if (!popoverOpen) return
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (popoverRef.current?.contains(target)) return
      if (settingsBtnRef.current?.contains(target)) return
      setPopoverOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [popoverOpen])

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
      ? 'text-[#859900] dark:text-[#859900]'
      : 'text-[#268bd2] dark:text-[#268bd2]'

  return (
    <>
      <div style={zenMode ? { display: 'none' } : undefined} className="flex items-center gap-1">
        <div className="mx-0.5 h-4 w-px bg-[#eee8d5] dark:bg-[#073642]" />
        {config.longBreakInterval > 0 && (
          <span className="mr-0.5 text-xs tabular-nums text-[#93a1a1] dark:text-[#586e75]">
            {timer.completedPomodoros}/{config.longBreakInterval}
          </span>
        )}
        <button
          onClick={toggleTimer}
          className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-sm tabular-nums hover:bg-[#eee8d5] dark:hover:bg-[#073642] ${phaseColor}`}
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
        <div className="relative">
          <button
            ref={settingsBtnRef}
            onClick={() => setPopoverOpen((o) => !o)}
            className="shrink-0 rounded p-1 text-[#657b83] hover:bg-[#eee8d5] dark:text-[#93a1a1] dark:hover:bg-[#073642]"
            aria-label="Timer settings"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2h12M6 22h12M7 2v4l5 6-5 6v4M17 2v4l-5 6 5 6v4" />
            </svg>
          </button>
        </div>
        {popoverOpen && createPortal(
          <div ref={popoverRef} className="fixed z-50 w-64 rounded-lg border border-[#eee8d5] bg-[#fdf6e3] p-3 shadow-lg dark:border-[#073642] dark:bg-[#002b36]" style={popoverPos}>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-[#93a1a1] dark:text-[#657b83]">
              Duration
            </div>
            <div className="mb-3 flex gap-1">
              {(['45/10', '60/10', '90/15'] as PomodoroPreset[]).map((p) => (
                <button
                  key={p}
                  onClick={() => handlePresetChange(p)}
                  className={`rounded px-2 py-1 text-xs font-medium ${
                    config.preset === p
                      ? 'bg-[#268bd2] text-white'
                      : 'bg-[#eee8d5] text-[#586e75] hover:bg-[#ddd6c1] dark:bg-[#073642] dark:text-[#93a1a1] dark:hover:bg-[#0a4052]'
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => handlePresetChange('custom')}
                className={`rounded px-2 py-1 text-xs font-medium ${
                  config.preset === 'custom'
                    ? 'bg-[#268bd2] text-white'
                    : 'bg-[#eee8d5] text-[#586e75] hover:bg-[#ddd6c1] dark:bg-[#073642] dark:text-[#93a1a1] dark:hover:bg-[#0a4052]'
                }`}
              >
                Custom
              </button>
            </div>
            {config.preset === 'custom' && (
              <div className="mb-3 flex items-center gap-2">
                <label className="flex items-center gap-1 text-xs text-[#586e75] dark:text-[#93a1a1]">
                  <span>Work</span>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={customWork}
                    onChange={(e) => setCustomWork(e.target.value)}
                    className="h-6 w-12 rounded border border-[#93a1a1]/30 bg-transparent px-1 text-center text-xs text-[#073642] outline-none focus:border-[#268bd2] dark:text-[#eee8d5]"
                  />
                </label>
                <label className="flex items-center gap-1 text-xs text-[#586e75] dark:text-[#93a1a1]">
                  <span>Break</span>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={customBreak}
                    onChange={(e) => setCustomBreak(e.target.value)}
                    className="h-6 w-12 rounded border border-[#93a1a1]/30 bg-transparent px-1 text-center text-xs text-[#073642] outline-none focus:border-[#268bd2] dark:text-[#eee8d5]"
                  />
                </label>
                <button
                  onClick={handleCustomApply}
                  className="rounded bg-[#268bd2] px-2 py-0.5 text-xs text-white hover:bg-[#268bd2]/90"
                >
                  Set
                </button>
              </div>
            )}
            <div className="mb-2 border-t border-[#eee8d5] pt-2 dark:border-[#073642]">
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-[#93a1a1] dark:text-[#657b83]">
                Notifications
              </div>
              <div className="flex cursor-pointer items-center justify-between text-xs text-[#586e75] dark:text-[#93a1a1]">
                <span>Audio chime</span>
                <button
                  onClick={handleToggleAudio}
                  className={`shrink-0 relative h-5 w-9 rounded-full transition-colors ${
                    config.audioEnabled
                      ? 'bg-[#268bd2]'
                      : 'bg-[#93a1a1]/30 dark:bg-[#586e75]/40'
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
            <div className="border-t border-[#eee8d5] pt-2 dark:border-[#073642]">
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-[#93a1a1] dark:text-[#657b83]">
                Timer
              </div>
              <div className="flex gap-1">
                <button
                  onClick={skipPhase}
                  className="flex-1 rounded px-2 py-1 text-xs text-[#586e75] hover:bg-[#eee8d5] dark:text-[#93a1a1] dark:hover:bg-[#073642]"
                >
                  Skip
                </button>
                <button
                  onClick={resetTimer}
                  className="flex-1 rounded px-2 py-1 text-xs text-[#dc322f] hover:bg-[#dc322f]/10"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>,
          document.body,
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
