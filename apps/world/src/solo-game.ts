/** Serializable rules shared by the room authority and the offline Game Lab. */
export const SOLO_PLAY_MS = 120_000
export const SOLO_TARGET = 4
export type SoloPause = 'preparing' | 'checking' | 'away' | 'feedback' | 'technical' | 'menu'
export type SoloRun = {
  streak: number
  best: number
  answered: number
  remainingMs: number
  runningSince: number | null
  pauses: SoloPause[]
  pending: string | null
  outcome: 'won' | 'timeout' | 'exhausted' | null
}

export function createSoloRun(): SoloRun {
  return {
    streak: 0,
    best: 0,
    answered: 0,
    remainingMs: SOLO_PLAY_MS,
    runningSince: null,
    pauses: ['preparing'],
    pending: null,
    outcome: null,
  }
}

export function soloRemaining(run: SoloRun, now: number): number {
  return Math.max(
    0,
    run.remainingMs - (run.runningSince === null ? 0 : Math.max(0, now - run.runningSince))
  )
}

/** Consume elapsed active time once; overlapping pauses must never add time twice. */
export function tickSolo(run: SoloRun, now: number): void {
  if (run.outcome) return
  run.remainingMs = soloRemaining(run, now)
  if (run.runningSince !== null) run.runningSince = now
  if (run.remainingMs === 0) {
    run.outcome = 'timeout'
    run.runningSince = null
    run.pending = null
  }
}

export function pauseSolo(run: SoloRun, reason: SoloPause, now: number): void {
  tickSolo(run, now)
  if (run.outcome) return
  if (!run.pauses.includes(reason)) run.pauses.push(reason)
  run.runningSince = null
}

export function resumeSolo(run: SoloRun, reason: SoloPause, now: number): void {
  if (run.outcome) return
  run.pauses = run.pauses.filter(item => item !== reason)
  if (run.pauses.length === 0 && run.runningSince === null) run.runningSince = now
}

/** Only a live question may accept one operation; stale/repeated sends are ignored. */
export function submitSolo(run: SoloRun, operation: string, now: number): boolean {
  tickSolo(run, now)
  if (run.outcome || run.pending || run.pauses.length > 0 || !operation) return false
  run.pending = operation
  pauseSolo(run, 'checking', now)
  return true
}

export function settleSolo(
  run: SoloRun,
  operation: string,
  status: 'correct' | 'wrong' | 'skipped' | 'clarify' | 'unavailable',
  now: number
): boolean {
  if (run.outcome || !run.pending || run.pending !== operation) return false
  run.pending = null
  // Add the next pause before releasing checking, including when the player is away.
  pauseSolo(run, status === 'unavailable' ? 'technical' : 'feedback', now)
  resumeSolo(run, 'checking', now)
  if (status === 'unavailable' || status === 'clarify') return true
  run.answered++
  run.streak = status === 'correct' ? run.streak + 1 : 0
  run.best = Math.max(run.best, run.streak)
  if (run.streak === SOLO_TARGET) {
    run.outcome = 'won'
    run.runningSince = null
  }
  return true
}
