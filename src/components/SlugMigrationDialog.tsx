import { useCallback, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'

export interface OrphanCandidate {
  old_slug: string
  new_slug_candidate: string
  dir_path: string
  evidence: string[]
}

type RowStatus = 'pending' | 'accepted' | 'rejected' | 'skipped'

interface Props {
  candidates: OrphanCandidate[]
  onComplete: () => void
}

export function SlugMigrationDialog({ candidates, onComplete }: Props) {
  const [statuses, setStatuses] = useState<RowStatus[]>(
    () => candidates.map(() => 'pending'),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateStatus = useCallback((index: number, status: RowStatus) => {
    setStatuses((prev) => {
      const next = [...prev]
      next[index] = status
      return next
    })
  }, [])

  const handleAccept = useCallback(
    async (index: number) => {
      const candidate = candidates[index]
      setBusy(true)
      setError(null)
      try {
        await invoke('migrate_slug', {
          oldSlug: candidate.old_slug,
          newSlug: candidate.new_slug_candidate,
          dirPath: candidate.dir_path,
        })

        // Update localStorage: progress
        try {
          const raw = localStorage.getItem('axiomatic:progress')
          if (raw) {
            const map = JSON.parse(raw) as Record<string, unknown>
            if (candidate.old_slug in map) {
              map[candidate.new_slug_candidate] = map[candidate.old_slug]
              delete map[candidate.old_slug]
              localStorage.setItem('axiomatic:progress', JSON.stringify(map))
            }
          }
        } catch { /* best effort */ }

        // Update localStorage: starred
        try {
          const raw = localStorage.getItem('axiomatic:starred')
          if (raw) {
            const map = JSON.parse(raw) as Record<string, unknown>
            if (candidate.old_slug in map) {
              map[candidate.new_slug_candidate] = map[candidate.old_slug]
              delete map[candidate.old_slug]
              localStorage.setItem('axiomatic:starred', JSON.stringify(map))
            }
          }
        } catch { /* best effort */ }

        // Update localStorage: snipXp
        try {
          const xpKey = `snipXp:${candidate.old_slug}`
          const val = localStorage.getItem(xpKey)
          if (val !== null) {
            localStorage.setItem(`snipXp:${candidate.new_slug_candidate}`, val)
            localStorage.removeItem(xpKey)
          }
        } catch { /* best effort */ }

        // Update localStorage: tabs
        try {
          const raw = localStorage.getItem('axiomatic:tabs')
          if (raw) {
            const state = JSON.parse(raw) as {
              tabs: Array<{ slug: string; title: string; fullPath: string; route: string }>
              activeSlug: string | null
            }
            let changed = false
            for (const tab of state.tabs) {
              if (tab.slug === candidate.old_slug) {
                tab.slug = candidate.new_slug_candidate
                tab.route = tab.route.replace(candidate.old_slug, candidate.new_slug_candidate)
                changed = true
              }
            }
            if (state.activeSlug === candidate.old_slug) {
              state.activeSlug = candidate.new_slug_candidate
              changed = true
            }
            if (changed) {
              localStorage.setItem('axiomatic:tabs', JSON.stringify(state))
            }
          }
        } catch { /* best effort */ }

        updateStatus(index, 'accepted')
      } catch (err) {
        setError(`Migration failed for ${candidate.old_slug}: ${err}`)
      } finally {
        setBusy(false)
      }
    },
    [candidates, updateStatus],
  )

  const handleReject = useCallback(
    (index: number) => updateStatus(index, 'rejected'),
    [updateStatus],
  )

  const handleSkip = useCallback(
    (index: number) => updateStatus(index, 'skipped'),
    [updateStatus],
  )

  const allResolved = statuses.every((s) => s !== 'pending')

  return (
    <Modal
      onClose={onComplete}
      ariaLabel="Slug migration"
      className="mx-4 flex max-h-[80vh] w-full max-w-2xl flex-col"
    >
        <div className="flex items-center justify-between border-b border-base2 px-5 py-3 dark:border-base02">
          <h2 className="text-sm font-semibold text-base02 dark:text-base2">
            Renamed files detected
          </h2>
          <span className="text-xs text-base1">
            {statuses.filter((s) => s !== 'pending').length}/{candidates.length} resolved
          </span>
        </div>

        <p className="border-b border-base2 px-5 py-2 text-xs text-base00 dark:border-base02 dark:text-base1">
          The following slugs have associated data (highlights, notes, etc.) but no matching PDF file.
          They may have been renamed. Accept to migrate data to the new slug.
        </p>

        {error && (
          <div className="mx-5 mt-2 rounded bg-red/10 px-3 py-1.5 text-xs text-red dark:bg-red/20 dark:text-red">
            {error}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          <div className="space-y-3">
            {candidates.map((c, i) => {
              const status = statuses[i]
              return (
                <div
                  key={c.old_slug}
                  className={`rounded-lg border p-3 transition ${
                    status === 'accepted'
                      ? 'border-green/40 bg-green/10 dark:border-green/30 dark:bg-green/10'
                      : status === 'rejected'
                        ? 'border-red/40 bg-red/10 dark:border-red/30 dark:bg-red/10'
                        : status === 'skipped'
                          ? 'border-base1/30 bg-base2/50 opacity-60 dark:border-base01/30 dark:bg-base02/50'
                          : 'border-base2 dark:border-base02'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-mono text-orange">{c.old_slug}</span>
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="shrink-0 text-base1"
                        >
                          <line x1="5" y1="12" x2="19" y2="12" />
                          <polyline points="12 5 19 12 12 19" />
                        </svg>
                        <span className="font-mono text-green">{c.new_slug_candidate}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-base1">
                        <span>Data in: {c.evidence.join(', ')}</span>
                      </div>
                    </div>

                    {status === 'pending' && (
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          disabled={busy}
                          onClick={() => handleAccept(i)}
                          className="rounded px-2 py-1 text-xs font-medium text-green hover:bg-green/10 disabled:opacity-50"
                        >
                          Accept
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => handleReject(i)}
                          className="rounded px-2 py-1 text-xs font-medium text-red hover:bg-red/10 disabled:opacity-50"
                        >
                          Reject
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => handleSkip(i)}
                          className="rounded px-2 py-1 text-xs font-medium text-base1 hover:bg-base1/10 disabled:opacity-50"
                        >
                          Skip
                        </button>
                      </div>
                    )}

                    {status !== 'pending' && (
                      <span
                        className={`shrink-0 text-xs font-medium ${
                          status === 'accepted'
                            ? 'text-green'
                            : status === 'rejected'
                              ? 'text-red'
                              : 'text-base1'
                        }`}
                      >
                        {status === 'accepted'
                          ? 'Migrated'
                          : status === 'rejected'
                            ? 'Rejected'
                            : 'Skipped'}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex items-center justify-end border-t border-base2 px-5 py-3 dark:border-base02">
          <Button
            variant={allResolved ? 'primary' : 'secondary'}
            onClick={onComplete}
            disabled={busy}
          >
            {allResolved ? 'Done' : 'Dismiss'}
          </Button>
        </div>
    </Modal>
  )
}
