import type { OngoingPlan, Plan } from '~common/types'
import {
  findMeditationForDate,
  getScheduledPlanDay,
  toCivilDate,
} from '~features/plans/readingCalendar'

export interface ReadingReminder {
  id: string
  timestamp: number
  title?: string
  data: Record<string, string>
}

/** Build a bounded, date-specific schedule shared by the native delivery adapter and tests. */
export const buildReadingReminderSchedule = ({
  sourceId,
  time,
  plans,
  ongoing,
  owner,
  now = new Date(),
  days = 28,
  limit = 48,
}: {
  sourceId?: string | null
  time?: string
  plans: Plan[]
  ongoing: OngoingPlan[]
  owner: string
  now?: Date
  days?: number
  limit?: number
}): ReadingReminder[] => {
  const result: ReadingReminder[] = []
  for (let offset = 0; offset < days; offset++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, 12)
    const dateKey = toCivilDate(date)
    const candidates: {
      key: string
      time: string
      title?: string
      data: Record<string, string>
    }[] = []
    const collection = plans.find(plan => plan.id === sourceId)
    if (
      time &&
      (!sourceId ||
        (collection && findMeditationForDate(collection, dateKey).status === 'available'))
    ) {
      candidates.push({
        key: 'daily',
        time,
        title: collection?.title,
        data: sourceId
          ? { kind: 'meditation', collectionId: sourceId, date: dateKey, owner }
          : { kind: 'verse', date: dateKey, owner },
      })
    }
    for (const participation of ongoing) {
      if (
        !participation.startDate ||
        !participation.reminderTime ||
        participation.status === 'Completed'
      )
        continue
      const plan = plans.find(item => item.id === participation.id)
      const day = getScheduledPlanDay(participation.startDate, dateKey)
      const reading = day && plan?.sections.flatMap(section => section.readingSlices)[day - 1]
      if (!reading || participation.readingSlices[reading.id] === 'Completed') continue
      candidates.push({
        key: `plan:${participation.id}`,
        time: participation.reminderTime,
        title: plan!.title,
        data: { kind: 'plan', planId: participation.id, date: dateKey, owner },
      })
    }
    for (const candidate of candidates) {
      const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(candidate.time)
      if (!match) continue
      const timestamp = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        Number(match[1]),
        Number(match[2])
      ).getTime()
      if (timestamp <= now.getTime()) continue
      result.push({
        id: `reading:${candidate.key}:${dateKey}`,
        timestamp,
        title: candidate.title,
        data: { ...candidate.data, scope: candidate.key, deliveryAt: String(timestamp) },
      })
    }
  }
  return result
    .sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id))
    .slice(0, limit)
}
