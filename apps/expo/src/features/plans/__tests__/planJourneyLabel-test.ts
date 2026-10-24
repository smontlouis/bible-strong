import type { TFunction } from 'i18next'
import { getJourneyDetail } from '../planJourneyLabel'
import { getPlanJourney } from '../planSchedule'
import { getReadingSliceFirstVerse, getReadingSliceLabel } from '../entitySliceTitle'

jest.mock('~helpers/chapterToReference', () => ({
  chapterToReference: (chapters: string) => `chapitres ${chapters}`,
}))
jest.mock('~helpers/verseToReference', () => ({
  __esModule: true,
  default: (verses: string) => `versets ${verses}`,
}))

const t = ((key: string, options?: Record<string, unknown>) =>
  options ? `${key} ${JSON.stringify(options)}` : key) as unknown as TFunction
const days = (pattern: string) => [...pattern].map(day => day === 'x')
const detail = (pattern: string, startDate?: string, date = '2026-09-13') =>
  getJourneyDetail(getPlanJourney(days(pattern), startDate, date), t, {
    startDate,
    language: 'fr',
  })

it('says where a followed plan stands against its calendar', () => {
  expect(detail('x....', '2026-09-10')).toBe(
    'readingPlans.dayOfTotal {"day":4,"total":5} · readingPlans.behind {"count":2}'
  )
  expect(detail('xxxx.', '2026-09-10')).toBe(
    'readingPlans.dayOfTotal {"day":4,"total":5} · readingPlans.upToDate'
  )
  expect(detail('xx...', '2026-09-11')).toBe('readingPlans.dayOfTotal {"day":3,"total":5}')
  expect(detail('.....', '2026-09-20')).toMatch(/^readingPlans\.startsOn/)
  expect(detail('xxxxx', '2026-09-10')).toBe('readingPlans.finished')
  expect(detail('xx...')).toBe('readingPlans.dayOfTotal {"day":3,"total":5}')
})

it('names a day by its own title, or by its passages when the title is only its number', () => {
  const slices = [
    { type: 'Video' as const, id: 'v', title: 'BibleProject', url: '' },
    { type: 'Verse' as const, verses: '23|30:18-19' },
    { type: 'Chapter' as const, id: 'c', chapters: '43|1' },
  ]
  expect(getReadingSliceLabel({ id: 'd', title: 'Jour 3', slices }, t)).toBe(
    'versets 23|30:18-19, chapitres 43|1'
  )
  expect(getReadingSliceLabel({ id: 'd', title: 'Marc 9', slices }, t)).toBe('Marc 9')
  expect(getReadingSliceLabel({ id: 'd', slices: [slices[0]] }, t)).toBe('BibleProject')
  expect(getReadingSliceFirstVerse({ id: 'd', slices })).toBe('23-30-18')
  expect(getReadingSliceFirstVerse({ id: 'd', slices: [slices[2]] })).toBe('43-1-1')
  expect(getReadingSliceFirstVerse({ id: 'd', slices: [slices[0]] })).toBeUndefined()
})
