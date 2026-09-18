import { parseSourcedTimelineDates } from '~features/timeline/sourcedDates'
import { orderTimelineRows } from '../widgets/timelineRows'
import type { TimelineEvent } from '~features/timeline/types'
const meta = (slug: string, start: number): TimelineEvent => ({
  id: 1,
  title: slug,
  titleEn: slug,
  slug,
  start,
  end: start,
  row: 0,
  type: 'major',
})
it('orders only by sourced numeric dates and keeps unknown dates last', () => {
  const rows = [
    { slug: 'later', meta: meta('later', 31) },
    { slug: 'unknown' },
    { slug: 'earlier', meta: meta('earlier', -4) },
    { slug: 'bad', meta: meta('bad', NaN) },
  ]
  const ordered = orderTimelineRows(rows)
  expect(ordered.map(row => row.slug)).toEqual(['earlier', 'later', 'unknown', 'bad'])
  expect(ordered[3].meta).toBeUndefined()
  expect(rows[0].slug).toBe('later')
})
it('uses explicit editorial era dates when an event has no legacy geometry', () => {
  const details = (slug: string, dates: string) => ({
    id: slug,
    slug,
    title: slug,
    dates,
    period: '',
    description: '',
    article: '',
    related: [],
    images: [],
    videos: [],
    scriptures: [],
  })
  const rows = orderTimelineRows([
    { slug: 'resurrection', meta: meta('resurrection', 31) },
    { slug: 'birth', detail: details('birth', '4 BC') },
  ])
  expect(rows.map(row => row.slug)).toEqual(['birth', 'resurrection'])
  expect(rows[0].position?.start).toBe(-4)
})
it('does not manufacture dates from narrative descriptions', () => {
  expect(parseSourcedTimelineDates('c. 1445 BC')).toEqual({
    start: -1445,
    end: -1445,
    approx: true,
  })
  expect(parseSourcedTimelineDates('538-1798 AD')).toEqual({ start: 538, end: 1798, approx: false })
  expect(parseSourcedTimelineDates('before the flood')).toBeUndefined()
  expect(parseSourcedTimelineDates('0 AD')).toBeUndefined()
})
