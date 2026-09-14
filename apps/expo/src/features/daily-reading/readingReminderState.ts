import { atom } from 'jotai/vanilla'
import type { ReadingNotificationPermission } from './readingReminderReconciler'

/** Device delivery state is deliberately separate from synced reading preferences. */
export interface ReadingReminderState {
  permission: ReadingNotificationPermission
  phase: 'idle' | 'busy' | 'scheduled' | 'blocked' | 'error'
  through: Record<string, string>
  retry: number
}

export const readingReminderStateAtom = atom<ReadingReminderState>({
  permission: 'not-requested',
  phase: 'idle',
  through: {},
  retry: 0,
})
