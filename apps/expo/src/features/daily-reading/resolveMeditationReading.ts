import type { Plan } from '~common/types'
import {
  findMeditationForDate,
  getMeditationDateKey,
  isCivilDate,
} from '~features/plans/readingCalendar'

/** An explicit reading ID wins over a date, including undated complementary entries. */
export const resolveMeditationReading = (
  collection: Plan,
  readingId: string | undefined,
  requestedDate: string | undefined,
  today: string
) => {
  if (readingId) {
    const reading = collection.sections
      .flatMap(section => section.readingSlices)
      .find(item => item.id === readingId)
    const key = reading && getMeditationDateKey(reading)
    const preferred =
      requestedDate && isCivilDate(requestedDate) && requestedDate.slice(5) === key
        ? requestedDate
        : `${today.slice(0, 4)}-${key}`
    return { reading, date: key ? (isCivilDate(preferred) ? preferred : `2024-${key}`) : undefined }
  }
  const date = requestedDate && isCivilDate(requestedDate) ? requestedDate : today
  const lookup = findMeditationForDate(collection, date)
  return { date, reading: lookup.status === 'available' ? lookup.reading : undefined }
}
