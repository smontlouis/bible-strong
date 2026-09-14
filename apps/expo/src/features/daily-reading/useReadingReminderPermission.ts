import type { ReadingReminderState } from './readingReminderState'
export interface ReadingReminderPermissionApi extends Omit<ReadingReminderState, 'retry'> {
  request: () => Promise<boolean>
  openSettings: () => Promise<void>
  retry: () => void
}
/** Web delivery is not configured; settings present the mobile-only capability. */
export const useReadingReminderPermission = (): ReadingReminderPermissionApi => ({
  permission: 'not-requested',
  phase: 'idle',
  through: {},
  request: async () => false,
  openSettings: async () => {},
  retry: () => {},
})
