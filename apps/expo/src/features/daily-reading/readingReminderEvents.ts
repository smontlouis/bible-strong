import { isCivilDate } from '~features/plans/readingCalendar'
import { READING_REMINDER_PREFIX } from './readingReminderReconciler'

export type ReadingReminderDestination =
  | { pathname: '/meditation'; params: { collectionId: string; date: string } }
  | { pathname: '/plan'; params: { planId: string; date: string } }
  | { pathname: '/daily-verse'; params: { date: string } }

export interface ReadingReminderPress {
  id: string
  data: { owner: string; date: string; deliveryAt?: string } & (
    | { kind: 'verse' }
    | { kind: 'meditation'; collectionId: string }
    | { kind: 'plan'; planId: string }
  )
}

export const readReminderPress = (id: unknown, data: unknown): ReadingReminderPress | undefined => {
  if (
    typeof id !== 'string' ||
    !id.startsWith(READING_REMINDER_PREFIX) ||
    !data ||
    typeof data !== 'object'
  )
    return undefined
  const value = data as Record<string, unknown>
  if (typeof value.owner !== 'string' || typeof value.date !== 'string' || !isCivilDate(value.date))
    return undefined
  const delivery: Record<string, string> =
    typeof value.deliveryAt === 'string' ? { deliveryAt: value.deliveryAt } : {}
  if (value.kind === 'verse')
    return { id, data: { ...delivery, kind: 'verse', owner: value.owner, date: value.date } }
  if (value.kind === 'meditation' && typeof value.collectionId === 'string' && value.collectionId)
    return {
      id,
      data: {
        ...delivery,
        kind: 'meditation',
        collectionId: value.collectionId,
        owner: value.owner,
        date: value.date,
      },
    }
  if (value.kind === 'plan' && typeof value.planId === 'string' && value.planId)
    return {
      id,
      data: {
        ...delivery,
        kind: 'plan',
        planId: value.planId,
        owner: value.owner,
        date: value.date,
      },
    }
  return undefined
}

export const getReminderDestination = (
  press: ReadingReminderPress,
  owner: string
): ReadingReminderDestination | undefined => {
  if (press.data.owner !== owner) return undefined
  const { data } = press
  if (data.kind === 'meditation')
    return {
      pathname: '/meditation',
      params: { collectionId: data.collectionId, date: data.date },
    }
  if (data.kind === 'plan')
    return { pathname: '/plan', params: { planId: data.planId, date: data.date } }
  return { pathname: '/daily-verse', params: { date: data.date } }
}

export interface ReminderInboxStorage {
  getString: (key: string) => string | undefined
  set: (key: string, value: string) => void
  remove: (key: string) => void
}

export const createReadingReminderInbox = (storage: ReminderInboxStorage) => ({
  remember(id: unknown, data: unknown) {
    const press = readReminderPress(id, data)
    if (press) storage.set('pending', JSON.stringify(press))
  },
  consume(owner: string): ReadingReminderDestination | undefined {
    const raw = storage.getString('pending')
    if (!raw) return undefined
    storage.remove('pending')
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return undefined
    }
    if (!parsed || typeof parsed !== 'object') return undefined
    const record = parsed as Record<string, unknown>
    const press = readReminderPress(record.id, record.data)
    if (!press) return undefined
    const key = JSON.stringify(press)
    if (storage.getString('consumed') === key) return undefined
    storage.set('consumed', key)
    return getReminderDestination(press, owner)
  },
})
