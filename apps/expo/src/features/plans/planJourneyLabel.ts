import type { TFunction } from 'i18next'
import type { PlanJourney } from './planSchedule'

const formatDay = (date: string, language: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString(language, { day: 'numeric', month: 'long' })

/**
 * Where a followed plan stands, in a row: "Jour 12 sur 30 · 2 en retard", "· à jour" once
 * today is read, the start date before it comes, or the end of the journey.
 */
export const getJourneyDetail = (
  journey: PlanJourney,
  t: TFunction,
  { startDate, language }: { startDate?: string; language: string }
): string => {
  if (journey.finished) return t('readingPlans.finished')
  if (startDate && journey.today !== undefined && journey.today < 1)
    return t('readingPlans.startsOn', { date: formatDay(startDate, language) })
  const day = t('readingPlans.dayOfTotal', { day: journey.currentDay, total: journey.total })
  if (journey.missed.length)
    return `${day} · ${t('readingPlans.behind', { count: journey.missed.length })}`
  if (journey.today !== undefined && journey.done[journey.currentDay - 1])
    return `${day} · ${t('readingPlans.upToDate')}`
  return day
}
