import type { StudyLinkView } from '@bible-strong/resource-domain/contracts/studyLinksContract'
import type { TimelineEventSummary } from '~features/resources/timelineAccess'
import { buildEntityChronology, closestMark, seenEvents } from '../entityChronology'

const link = (key: string, role: StudyLinkView['role'] = 'participant'): StudyLinkView => ({
  kind: 'timeline',
  key,
  label: `Title of ${key}`,
  detail: `Dates of ${key}`,
  role,
})

const listed = (slug: string, dates: string, period = '6'): TimelineEventSummary => ({
  id: slug,
  slug,
  title: slug,
  description: `  Summary of\n${slug}  `,
  period,
  dates,
  images: [{ caption: '', file: `${slug}.jpg` }],
})

const periods = [
  { id: '6', title: 'Le royaume uni', color: '#3b6eb5' },
  { id: '7', title: 'Le royaume divisé', color: '#23a6c5' },
]

const david = [
  listed('david', '1040-970 BC'),
  listed('anointed', '1029 BC'),
  listed('goliath', '1025 BC'),
  listed('jonathan', '1024 BC'),
  listed('hatred', '1024 BC'),
  listed('king', '1003-970 BC'),
]
const davidLinks = [
  link('david', 'subject'),
  link('anointed'),
  link('goliath'),
  link('jonathan'),
  link('hatred'),
  link('king'),
]

describe('buildEntityChronology', () => {
  it('has nothing to show without an event', () => {
    expect(
      buildEntityChronology([{ kind: 'nave', key: 'love', label: 'Amour' }], david, periods, 'fr')
    ).toBeUndefined()
  })

  it('leads with the event about the entity and scales the others on its years', () => {
    const chronology = buildEntityChronology(davidLinks, david, periods, 'fr')
    expect(chronology?.lead).toMatchObject({
      title: 'Title of david',
      dates: 'Dates of david',
      summary: 'Summary of david',
    })
    expect(chronology?.lead?.image).toContain('/timeline-images/w480/david.jpg.webp')
    expect(chronology?.events.map(event => event.link.key)).toEqual([
      'anointed',
      'goliath',
      'jonathan',
      'hatred',
      'king',
    ])
    expect(chronology?.ruler).toMatchObject({
      from: '1040 av. J.-C.',
      to: '970 av. J.-C.',
      color: '#3b6eb5',
    })
    expect(chronology?.ruler?.marks[0].left).toBeCloseTo((11 / 70) * 100)
  })

  it('shows the painting of an event that has one', () => {
    const chronology = buildEntityChronology(davidLinks, david, periods, 'fr', {
      david: { hash: 'abcdef', documents: [] },
    })
    expect(chronology?.lead?.image).toBe(
      'https://media.bible-strong.app/timeline-paintings/david/abcdef/w768.webp'
    )
    expect(chronology?.events[0].image).toContain('/timeline-images/w480/anointed.jpg.webp')
  })

  it('gives events of one year their own rows and a span its length', () => {
    const marks = buildEntityChronology(davidLinks, david, periods, 'fr')?.ruler?.marks ?? []
    expect(marks[2].left).toBe(marks[3].left)
    expect(marks[3].level).toBeGreaterThan(marks[2].level)
    expect(marks[4].width).toBeCloseTo((33 / 70) * 100)
  })

  it('shows an only event as the lead', () => {
    const chronology = buildEntityChronology([link('anointed')], david, periods, 'fr')
    expect(chronology?.lead?.link.key).toBe('anointed')
    expect(chronology?.events).toEqual([])
  })

  it('keeps a few events without a ruler', () => {
    const chronology = buildEntityChronology(davidLinks.slice(0, 4), david, periods, 'fr')
    expect(chronology?.events).toHaveLength(3)
    expect(chronology?.ruler).toBeUndefined()
    expect(chronology?.periods).toEqual([])
  })

  it('names the periods of a chronology that crosses several', () => {
    const events = [
      listed('a', '1029 BC'),
      listed('b', '1025 BC'),
      listed('c', '900 BC', '7'),
      listed('d', '850 BC', '7'),
    ]
    const chronology = buildEntityChronology(
      events.map(event => link(event.slug)),
      events,
      periods,
      'fr'
    )
    expect(chronology?.ruler).toBeUndefined()
    expect(chronology?.periods.map(({ title, count, first }) => [title, count, first])).toEqual([
      ['Le royaume uni', 2, 0],
      ['Le royaume divisé', 2, 2],
    ])
  })

  it('draws no ruler when the events are not dated in years', () => {
    const events = ['a', 'b', 'c', 'd'].map(slug => listed(slug, 'Future'))
    const chronology = buildEntityChronology(
      events.map(event => link(event.slug)),
      events,
      periods,
      'fr'
    )
    expect(chronology?.ruler).toBeUndefined()
  })

  it('keeps what a link says when the publication does not list its event', () => {
    const chronology = buildEntityChronology([link('gone'), link('other')], [], periods, 'fr')
    expect(chronology?.events[0]).toEqual({
      link: link('gone'),
      title: 'Title of gone',
      dates: 'Dates of gone',
    })
  })
})

describe('closestMark', () => {
  const marks = [
    { event: 0, left: 10, width: 0, level: 0 },
    { event: 1, left: 10, width: 0, level: 1 },
    { event: 2, left: 40, width: 40, level: 0 },
  ]
  const size = { width: 200, rowHeight: 10, levels: 2 }

  it('tells apart the events of one year by their row', () => {
    expect(closestMark(marks, { x: 20, y: 15 }, size)?.event).toBe(0)
    expect(closestMark(marks, { x: 20, y: 4 }, size)?.event).toBe(1)
  })

  it('takes a touch anywhere along a span', () => {
    expect(closestMark(marks, { x: 140, y: 15 }, size)?.event).toBe(2)
  })
})

describe('seenEvents', () => {
  const strip = { viewport: 390, count: 10, inset: 20, cardWidth: 200, gap: 12 }

  it('reads the cards whose middle is on screen', () => {
    expect(seenEvents({ ...strip, offset: 0 })).toEqual({ first: 0, last: 1 })
    expect(seenEvents({ ...strip, offset: 212 })).toEqual({ first: 1, last: 2 })
  })

  it('stays among the events at the end of the strip', () => {
    expect(seenEvents({ ...strip, offset: 2000 })).toEqual({ first: 9, last: 9 })
  })
})
