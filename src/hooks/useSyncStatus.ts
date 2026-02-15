export type SyncPhase = 'scanning' | 'rendering' | 'done'

export interface SyncStatusResult {
  phase: SyncPhase
  label: string
  bookCount: number
}

export function useSyncStatus(
  loading: boolean,
  totalItems: number,
  renderLimit: number,
): SyncStatusResult {
  let phase: SyncPhase
  if (loading) {
    phase = 'scanning'
  } else if (renderLimit < totalItems) {
    phase = 'rendering'
  } else {
    phase = 'done'
  }

  const label =
    phase === 'scanning'
      ? 'Scanning\u2026'
      : `${totalItems} book${totalItems === 1 ? '' : 's'}`

  return { phase, label, bookCount: totalItems }
}
