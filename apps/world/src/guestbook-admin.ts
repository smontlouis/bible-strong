import type { GuestbookEntry } from './guestbook'
export type AdminEntry = GuestbookEntry & {
  removedAt: number | null
  notification: 'queued' | 'sent' | 'legacy'
  notificationAttempts: number
}
export type AdminPage = {
  entries: AdminEntry[]
  cursor: number | null
  notificationsConfigured: boolean
  pendingNotifications: number
}
export type AdminFilter = 'all' | 'visible' | 'removed'
