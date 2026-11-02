import { describe, expect, it } from 'vitest'
import type { StudyLinkItem } from '../studyLinks/studyLinksRead'
import type { TimelineListedEvent } from '../timeline/timeline.functions'
import { buildAtlasChronology } from './atlasChronologyData'

const link = (key: string, role?: StudyLinkItem['role']): StudyLinkItem => ({
  kind: 'timeline',
  key,
  label: key,
  detail: 'as linked',
  path: `/timeline/fr/${key}`,
  ...(role ? { role } : {}),
})

const listed = (slug: string, dates: string, period = '6'): TimelineListedEvent => ({
  id: slug,
  slug,
  title: `Title of ${slug}`,
  dates,
  period,
  summary: `Summary of ${slug}`,
  image: `${slug}.jpg`,
})

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
  link('anointed', 'participant'),
  link('goliath', 'participant'),
  link('jonathan', 'participant'),
  link('hatred', 'participant'),
  link('king', 'participant'),
]

describe('buildAtlasChronology', () => {
  it('has nothing to show without an event', () => {
    expect(
      buildAtlasChronology(
        [{ kind: 'nave', key: 'love', label: 'Amour', path: '/nave/fr/love' }],
        david,
        'fr'
      )
    ).toBeUndefined()
  })

  it('leads with the event about the entity and scales the others on its years', () => {
    const chronology = buildAtlasChronology(davidLinks, david, 'fr')
    expect(chronology?.lead).toMatchObject({
      slug: 'david',
      dates: '1040–970 av. J.-C.',
      summary: 'Summary of david',
    })
    expect(chronology?.lead?.thumbnail).toContain('/timeline-images/w480/david.jpg.webp')
    expect(chronology?.events.map(event => event.slug)).toEqual([
      'anointed',
      'goliath',
      'jonathan',
      'hatred',
      'king',
    ])
    expect(chronology?.ruler).toMatchObject({ from: '1040 av. J.-C.', to: '970 av. J.-C.' })
    expect(chronology?.ruler?.marks[0].left).toBeCloseTo((11 / 70) * 100)
    expect(chronology?.placePath).toBe('/timeline/fr#on-david')
  })

  it('gives events of one year their own rows and a span its length', () => {
    const marks = buildAtlasChronology(davidLinks, david, 'fr')?.ruler?.marks ?? []
    expect(marks[2].left).toBe(marks[3].left)
    expect(marks[3].level).toBeGreaterThan(marks[2].level)
    expect(marks[4].width).toBeCloseTo((33 / 70) * 100)
  })

  it('shows an only event as the lead', () => {
    const chronology = buildAtlasChronology([link('anointed', 'participant')], david, 'fr')
    expect(chronology?.lead?.slug).toBe('anointed')
    expect(chronology?.events).toEqual([])
    expect(chronology?.ruler).toBeUndefined()
  })

  it('keeps a few events without a ruler', () => {
    const chronology = buildAtlasChronology(davidLinks.slice(0, 4), david, 'fr')
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
    const chronology = buildAtlasChronology(
      events.map(event => link(event.slug, 'participant')),
      events,
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
    const chronology = buildAtlasChronology(
      events.map(event => link(event.slug, 'participant')),
      events,
      'fr'
    )
    expect(chronology?.ruler).toBeUndefined()
    expect(chronology?.events[0].dates).toBe('Futur')
  })

  it('keeps what a link says when the publication does not list its event', () => {
    const chronology = buildAtlasChronology(
      [link('gone', 'participant'), link('other', 'participant')],
      [],
      'fr'
    )
    expect(chronology?.events[0]).toEqual({
      slug: 'gone',
      path: '/timeline/fr/gone',
      title: 'gone',
      dates: 'as linked',
    })
  })
})
