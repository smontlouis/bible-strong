import type { OngoingPlan } from '~common/types'
import { getScheduledPlanDay } from './readingCalendar'

/** Where a day of a plan stands against its calendar. */
export type PlanDayState = 'read' | 'missed' | 'today' | 'upcoming'

/** What « Continuer » leads to: the day to read, a day left behind, or a day already read. */
export type PlanContinueKind = 'continue' | 'catchUp' | 'reread'

/** A plan's days against today, as every screen that shows a followed plan reads them. */
export interface PlanJourney {
  total: number
  completed: number
  /** One flag per day, day 1 first. */
  done: boolean[]
  /** Today's day in the calendar: below 1 before the start, above `total` once it is over. */
  today?: number
  /** The day to show and read: today's, or the first unread one when there is no calendar. */
  currentDay: number
  /** Days of the calendar before today that are not read. */
  missed: number[]
  streak: number
  continueDay: number
  continueKind: PlanContinueKind
  finished: boolean
}

type Reading = { id: string; status?: string }

export const getDoneDays = (
  readings: readonly Reading[],
  completed?: OngoingPlan['readingSlices']
): boolean[] =>
  readings.map(reading => (completed ? completed[reading.id] : reading.status) === 'Completed')

const firstUnread = (done: boolean[]) => {
  const index = done.indexOf(false)
  return index < 0 ? Math.max(1, done.length) : index + 1
}

export const getPlanDayState = (done: boolean[], day: number, today?: number): PlanDayState => {
  if (done[day - 1]) return 'read'
  if (today === undefined) return 'upcoming'
  if (day === today) return 'today'
  return day < today ? 'missed' : 'upcoming'
}

/**
 * Today's day while the calendar runs. Before it starts, day 1; once it is over, or without a
 * calendar, the first day left to read.
 */
export const getPlanCurrentDay = (done: boolean[], today?: number): number => {
  if (!done.length) return 1
  if (today === undefined || today > done.length) return firstUnread(done)
  return Math.max(1, today)
}

export const getMissedDays = (done: boolean[], today?: number): number[] => {
  if (today === undefined) return []
  const last = Math.min(today - 1, done.length)
  const missed: number[] = []
  for (let day = 1; day <= last; day += 1) if (!done[day - 1]) missed.push(day)
  return missed
}

/**
 * Days of the calendar read in a row up to today, or up to yesterday while today is to read.
 * Once the calendar is over, it lasts only the day after its last day.
 */
export const getPlanStreak = (done: boolean[], today?: number): number => {
  if (today === undefined || today < 1 || today > done.length + 1) return 0
  let day = Math.min(today, done.length)
  if (today <= done.length && !done[day - 1]) day -= 1
  let streak = 0
  while (day >= 1 && done[day - 1]) {
    streak += 1
    day -= 1
  }
  return streak
}

/** `done` comes from `getDoneDays`; `date` is the reader's civil date. */
export const getPlanJourney = (
  done: boolean[],
  startDate: string | undefined,
  date: string
): PlanJourney => {
  const today = startDate ? getScheduledPlanDay(startDate, date) : undefined
  const currentDay = getPlanCurrentDay(done, today)
  const missed = getMissedDays(done, today)
  const completed = done.filter(Boolean).length
  const [continueDay, continueKind]: [number, PlanContinueKind] = !done[currentDay - 1]
    ? [currentDay, 'continue']
    : missed.length
      ? [missed[0], 'catchUp']
      : [currentDay, 'reread']
  return {
    total: done.length,
    completed,
    done,
    today,
    currentDay,
    missed,
    streak: getPlanStreak(done, today),
    continueDay,
    continueKind,
    finished: done.length > 0 && completed === done.length,
  }
}

/** The journey of a followed plan from its stored participation, for the lists. */
export const getParticipationJourney = (
  readings: readonly Reading[],
  participation: Pick<OngoingPlan, 'readingSlices' | 'startDate'> | undefined,
  date: string
): PlanJourney =>
  getPlanJourney(
    getDoneDays(readings, participation?.readingSlices ?? {}),
    participation?.startDate,
    date
  )
