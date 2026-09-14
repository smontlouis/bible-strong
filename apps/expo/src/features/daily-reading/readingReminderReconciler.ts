import type { ReadingReminder } from './readingReminderSchedule'

export const READING_REMINDER_PREFIX = 'reading:'
export const READING_REMINDER_CHANNEL = 'daily-reading'
export type ReadingNotificationPermission = 'not-requested' | 'allowed' | 'denied'

export interface ReminderDelivery extends ReadingReminder {
  title: string
  body: string
}
export interface ExistingReminder {
  id: string
  timestamp?: number
  title?: string
  body?: string
  data?: Record<string, unknown>
  legacyDaily?: boolean
}
export interface ReadingReminderDriver {
  scheduled: () => Promise<ExistingReminder[]>
  displayed: () => Promise<ExistingReminder[]>
  permission: () => Promise<ReadingNotificationPermission>
  cancelScheduled: (id: string) => Promise<void>
  removeDisplayed: (id: string) => Promise<void>
  schedule: (reminder: ReminderDelivery) => Promise<void>
}
export interface ReminderReconciliationResult {
  phase: 'idle' | 'scheduled' | 'blocked' | 'superseded'
  permission?: ReadingNotificationPermission
  through: Record<string, string>
}

const owned = (item: ExistingReminder) =>
  item.id.startsWith(READING_REMINDER_PREFIX) || item.legacyDaily
const sameDelivery = (existing: ExistingReminder, desired: ReminderDelivery) =>
  existing.timestamp === desired.timestamp &&
  existing.title === desired.title &&
  existing.body === desired.body &&
  Object.keys(existing.data ?? {}).length === Object.keys(desired.data).length &&
  Object.entries(desired.data).every(([key, value]) => existing.data?.[key] === value)

/** No permission prompts here: permission requests belong to explicit UI actions. */
export const reconcileReadingReminders = async (
  driver: ReadingReminderDriver,
  desired: ReminderDelivery[],
  owner: string,
  isCurrent: () => boolean
): Promise<ReminderReconciliationResult> => {
  const superseded: ReminderReconciliationResult = { phase: 'superseded', through: {} }
  const existing = await driver.scheduled()
  if (!isCurrent()) return superseded
  const desiredById = new Map(desired.map(item => [item.id, item]))
  for (const item of existing) {
    if (!isCurrent()) return superseded
    if (owned(item) && (!desiredById.has(item.id) || item.data?.owner !== owner))
      await driver.cancelScheduled(item.id)
  }
  const displayed = await driver.displayed()
  for (const item of displayed) {
    if (!isCurrent()) return superseded
    // Keep older, same-owner readings openable; remove private destinations on account changes.
    if (item.id.startsWith(READING_REMINDER_PREFIX) && item.data?.owner !== owner)
      await driver.removeDisplayed(item.id)
  }
  const permission = await driver.permission()
  if (!isCurrent()) return superseded
  if (!desired.length) return { phase: 'idle', permission, through: {} }
  if (permission !== 'allowed') return { phase: 'blocked', permission, through: {} }
  const existingById = new Map(existing.map(item => [item.id, item]))
  const through: Record<string, string> = {}
  for (const reminder of desired) {
    if (!isCurrent()) return superseded
    const current = existingById.get(reminder.id)
    if (!current || !sameDelivery(current, reminder)) await driver.schedule(reminder)
    const date = reminder.data.date
    const scope = reminder.data.scope
    if (scope && date && (!through[scope] || date > through[scope])) through[scope] = date
  }
  return isCurrent() ? { phase: 'scheduled', permission, through } : superseded
}

/** Serialize OS mutations. A superseded snapshot must never recreate another owner's reminders. */
export const createReadingReminderQueue = (
  driver: ReadingReminderDriver,
  currentOwner?: () => string
) => {
  let revision = 0
  let tail: Promise<unknown> = Promise.resolve()
  return {
    reconcile(desired: ReminderDelivery[], owner: string) {
      const current = ++revision
      const result = tail
        .catch(() => undefined)
        .then(() =>
          reconcileReadingReminders(
            driver,
            desired,
            owner,
            () => current === revision && (!currentOwner || currentOwner() === owner)
          )
        )
      tail = result
      return result
    },
    invalidate() {
      revision++
    },
  }
}
