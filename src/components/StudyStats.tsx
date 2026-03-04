import { useEffect, useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

interface StudySessionBook {
  slug: string
  dirPath: string
}

interface StudySession {
  id: string
  startedAt: string
  endedAt: string
  durationMinutes: number
  books: StudySessionBook[]
}

interface DayBucket {
  label: string
  dateKey: string
  minutes: number
}

/** Build a YYYY-MM-DD key for a Date in local time. */
function dateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface Props {
  dirPaths: string[]
}

export function StudyStats({ dirPaths }: Props) {
  const [sessions, setSessions] = useState<StudySession[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (dirPaths.length === 0) {
      setSessions([])
      setLoaded(true)
      return
    }

    let cancelled = false

    async function fetchAll() {
      const results: StudySession[] = []
      for (const dirPath of dirPaths) {
        try {
          const dirSessions = await invoke<StudySession[]>('list_study_sessions', { dirPath })
          results.push(...dirSessions)
        } catch (err) {
          console.error(`list_study_sessions failed for ${dirPath}:`, err)
        }
      }
      if (!cancelled) {
        setSessions(results)
        setLoaded(true)
      }
    }

    fetchAll()
    return () => { cancelled = true }
  }, [dirPaths])

  const { todayMinutes, weekMinutes, todayPomodoros, weekPomodoros, weekBooks, buckets } =
    useMemo(() => {
      const now = new Date()
      const todayKey = dateKey(now)

      // Build the last 7 days (today and 6 prior days)
      const days: DayBucket[] = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now)
        d.setDate(d.getDate() - i)
        days.push({
          label: WEEKDAY_LABELS[d.getDay()],
          dateKey: dateKey(d),
          minutes: 0,
        })
      }
      const weekKeys = new Set(days.map((d) => d.dateKey))

      let todayMin = 0
      let weekMin = 0
      let todayPom = 0
      let weekPom = 0
      const weekBookSlugs = new Set<string>()

      for (const session of sessions) {
        const sessionDate = dateKey(new Date(session.startedAt))

        if (sessionDate === todayKey) {
          todayMin += session.durationMinutes
          todayPom += 1
        }

        if (weekKeys.has(sessionDate)) {
          weekMin += session.durationMinutes
          weekPom += 1
          for (const book of session.books) {
            weekBookSlugs.add(book.slug)
          }
          // Accumulate into the bucket
          const bucket = days.find((d) => d.dateKey === sessionDate)
          if (bucket) bucket.minutes += session.durationMinutes
        }
      }

      return {
        todayMinutes: todayMin,
        weekMinutes: weekMin,
        todayPomodoros: todayPom,
        weekPomodoros: weekPom,
        weekBooks: weekBookSlugs.size,
        buckets: days,
      }
    }, [sessions])

  if (!loaded) return null

  const maxMinutes = Math.max(...buckets.map((b) => b.minutes), 1)
  const hasAnySessions = sessions.length > 0

  return (
    <section className="px-4 pt-4 pb-2">
      <h2 className="mb-3 text-sm font-medium text-[#657b83] dark:text-[#93a1a1]">
        Study Stats
      </h2>

      {!hasAnySessions ? (
        <div className="rounded-lg border border-[#eee8d5] bg-[#eee8d5]/40 px-4 py-6 text-center dark:border-[#073642] dark:bg-[#073642]/40">
          <p className="text-sm text-[#657b83] dark:text-[#93a1a1]">
            No study sessions yet. Start a pomodoro timer while reading to track your progress!
          </p>
          <div className="mt-3 flex justify-center gap-6 text-xs text-[#93a1a1] dark:text-[#586e75]">
            <span>0 min today</span>
            <span>0 pomodoros</span>
            <span>0 books</span>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-[#eee8d5] bg-[#eee8d5]/40 px-4 py-3 dark:border-[#073642] dark:bg-[#073642]/40">
          {/* Summary counters */}
          <div className="mb-4 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-5">
            <div>
              <div className="text-xs text-[#93a1a1] dark:text-[#586e75]">Today</div>
              <div className="text-lg font-semibold tabular-nums text-[#073642] dark:text-[#eee8d5]">
                {formatMinutes(todayMinutes)}
              </div>
            </div>
            <div>
              <div className="text-xs text-[#93a1a1] dark:text-[#586e75]">This week</div>
              <div className="text-lg font-semibold tabular-nums text-[#073642] dark:text-[#eee8d5]">
                {formatMinutes(weekMinutes)}
              </div>
            </div>
            <div>
              <div className="text-xs text-[#93a1a1] dark:text-[#586e75]">Pomodoros today</div>
              <div className="text-lg font-semibold tabular-nums text-[#073642] dark:text-[#eee8d5]">
                {todayPomodoros}
              </div>
            </div>
            <div>
              <div className="text-xs text-[#93a1a1] dark:text-[#586e75]">Pomodoros this week</div>
              <div className="text-lg font-semibold tabular-nums text-[#073642] dark:text-[#eee8d5]">
                {weekPomodoros}
              </div>
            </div>
            <div>
              <div className="text-xs text-[#93a1a1] dark:text-[#586e75]">Books this week</div>
              <div className="text-lg font-semibold tabular-nums text-[#073642] dark:text-[#eee8d5]">
                {weekBooks}
              </div>
            </div>
          </div>

          {/* 7-day bar chart */}
          <div className="flex items-end gap-2" style={{ height: 80 }}>
            {buckets.map((bucket) => {
              const fraction = bucket.minutes / maxMinutes
              const barHeight = bucket.minutes === 0 ? 2 : Math.max(4, fraction * 64)
              return (
                <div key={bucket.dateKey} className="flex flex-1 flex-col items-center gap-1">
                  {bucket.minutes > 0 && (
                    <span className="text-[10px] tabular-nums text-[#586e75] dark:text-[#93a1a1]">
                      {bucket.minutes}m
                    </span>
                  )}
                  <div
                    className={`w-full rounded-sm ${
                      bucket.minutes > 0
                        ? 'bg-[#859900] dark:bg-[#859900]'
                        : 'bg-[#93a1a1]/20 dark:bg-[#586e75]/30'
                    }`}
                    style={{ height: barHeight }}
                  />
                  <span className="text-[10px] text-[#93a1a1] dark:text-[#586e75]">
                    {bucket.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}

function formatMinutes(total: number): string {
  if (total < 60) return `${total}m`
  const h = Math.floor(total / 60)
  const m = total % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}
