import {
  createReadingReminderInbox,
  type ReminderInboxStorage,
} from '~features/daily-reading/readingReminderEvents'
import {
  createReadingReminderQueue,
  type ExistingReminder,
  type ReadingNotificationPermission,
  type ReadingReminderDriver,
} from '~features/daily-reading/readingReminderReconciler'
import { getCurrentAuthUser } from '~helpers/firebaseAuthRuntime'

import { call } from './call'

// Reading reminders on the desktop app (ADR-0119): the mobile apps' schedule and reconciliation,
// delivered by the shell (`apps/desktop/src-tauri/src/reminders.rs`).

type ShellReminder = {
  id: string
  timestamp: number
  title: string
  body: string
  data: Record<string, string>
}

export const readReadingPermission = () =>
  call<ReadingNotificationPermission>('reminders_permission')

const driver: ReadingReminderDriver = {
  scheduled: async () =>
    (await call<ShellReminder[]>('reminders_scheduled')).map(
      (reminder): ExistingReminder => ({ ...reminder })
    ),
  displayed: () => call<ExistingReminder[]>('reminders_displayed'),
  permission: readReadingPermission,
  cancelScheduled: id => call('reminders_cancel', { id }),
  removeDisplayed: id => call('reminders_remove_displayed', { id }),
  schedule: ({ id, timestamp, title, body, data }) =>
    call('reminders_schedule', { reminder: { id, timestamp, title, body, data } }),
}

export const readingReminderQueue = createReadingReminderQueue(
  driver,
  () => getCurrentAuthUser()?.uid ?? ''
)

export const requestReadingPermission = () =>
  call<ReadingNotificationPermission>('reminders_request_permission')

/** The system's notification settings, where the reader allows Bible Strong again. */
export const openReadingNotificationSettings = () => call('reminders_open_settings')

// The shell keeps a click until the page takes it (`inbox.rs`): the page only needs to hold it
// until the account is known and the navigation is ready.
const memory = new Map<string, string>()
const storage: ReminderInboxStorage = {
  getString: key => memory.get(key),
  set: (key, value) => void memory.set(key, value),
  remove: key => void memory.delete(key),
}
export const readingReminderInbox = createReadingReminderInbox(storage)

const listeners = new Set<() => void>()
export const subscribeReadingReminderClicks = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const REMINDER_URL = 'biblestrong://reading-reminder?'

/**
 * Keeps the reminder a clicked notification opens (`reminder_url` in `reminders.rs`) and tells
 * `ReadingReminders`, which opens its reading. False for any other address.
 */
export const takeReadingReminderUrl = (url: string): boolean => {
  if (!url.startsWith(REMINDER_URL)) return false
  try {
    const payload = new URLSearchParams(url.slice(REMINDER_URL.length)).get('payload')
    const reminder = payload ? (JSON.parse(payload) as Partial<ShellReminder>) : undefined
    if (reminder) readingReminderInbox.remember(reminder.id, reminder.data)
  } catch {
    // An address the shell did not write opens nothing.
  }
  listeners.forEach(listener => listener())
  return true
}
