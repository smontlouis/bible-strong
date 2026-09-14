import type { Plan } from '~common/types'
import { resolveMeditationReading } from '../resolveMeditationReading'

const book: Plan = {
  id: 'book',
  title: 'Book',
  lang: 'fr',
  type: 'meditation',
  author: { id: 'author', displayName: 'Author', photoUrl: '' },
  sections: [
    {
      id: 'all',
      title: '',
      subTitle: '',
      readingSlices: [
        { id: 'new-year', calendarDate: '01-01', title: 'New year', slices: [] },
        { id: 'leap', calendarDate: '02-29', title: 'Leap day', slices: [] },
        { id: 'extra', calendarDate: null, title: 'Extra', slices: [] },
      ],
    },
  ],
}

it('resolves the same meditation from a calendar date and an entry link', () => {
  const daily = resolveMeditationReading(book, undefined, '2025-01-01', '2026-09-14')
  const fromCollection = resolveMeditationReading(book, 'new-year', '2025-01-01', '2026-09-14')
  expect(fromCollection).toEqual(daily)
})
it('opens complementary entries without inventing a calendar date', () => {
  expect(resolveMeditationReading(book, 'extra', '2026-01-01', '2026-09-14')).toMatchObject({
    reading: { id: 'extra' },
    date: undefined,
  })
})
it('retains the identity of a leap-day entry in a non-leap year', () => {
  expect(resolveMeditationReading(book, 'leap', undefined, '2026-09-14')).toMatchObject({
    reading: { id: 'leap' },
    date: '2024-02-29',
  })
})
it('does not substitute another entry for a broken legacy reading ID', () => {
  expect(
    resolveMeditationReading(book, 'missing', '2026-01-01', '2026-09-14').reading
  ).toBeUndefined()
})
