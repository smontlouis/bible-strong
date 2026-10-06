import { describe, expect, it } from 'vitest'
import {
  buildTimelineEventPath,
  buildTimelineIndexPath,
  buildTimelinePeriodPath,
  buildWebAppTimelineUrl,
  isTimelineSlug,
  parseTimelineRoute,
  timelineEventBreadcrumbs,
} from './timelineRoutes'

describe('Timeline public routes', () => {
  it('reads the timeline of a language and one of its events', () => {
    expect(parseTimelineRoute({ language: 'fr' })).toEqual({ language: 'fr' })
    expect(parseTimelineRoute({ language: 'en', slug: 'birth-of-moses' })).toEqual({
      language: 'en',
      slug: 'birth-of-moses',
    })
  })

  it('carries the canonical lowercase form of another letter case', () => {
    expect(parseTimelineRoute({ language: 'FR' })).toEqual({ language: 'fr' })
    expect(parseTimelineRoute({ language: 'EN', slug: 'Birth-of-Moses' })).toEqual({
      language: 'en',
      slug: 'birth-of-moses',
    })
  })

  it('rejects unsupported languages and malformed slugs', () => {
    expect(parseTimelineRoute({})).toBeUndefined()
    expect(parseTimelineRoute({ language: 'de' })).toBeUndefined()
    expect(parseTimelineRoute({ language: 'de', slug: 'adam' })).toBeUndefined()
    for (const slug of ['', 'birth of moses', 'adam-', '-adam', 'adam--eve', 'adam/eve', 'ève']) {
      expect(parseTimelineRoute({ language: 'fr', slug })).toBeUndefined()
      expect(isTimelineSlug(slug)).toBe(false)
    }
  })

  it('accepts the slugs of the publication', () => {
    for (const slug of ['adam', '1-corinthians-written', 'cyrus-ii-conquers-babylon-oct-29']) {
      expect(isTimelineSlug(slug)).toBe(true)
    }
  })

  it('builds the timeline, event and period paths', () => {
    expect(buildTimelineIndexPath('fr')).toBe('/timeline/fr')
    expect(buildTimelineEventPath('en', 'birth-of-moses')).toBe('/timeline/en/birth-of-moses')
    expect(buildTimelinePeriodPath('fr', '9')).toBe('/timeline/fr#period-9')
    expect(() => buildTimelineEventPath('fr', 'Birth of Moses')).toThrow('TIMELINE_ROUTE_INVALID')
  })

  it('opens the same paths in the study workspace', () => {
    expect(buildWebAppTimelineUrl('fr')).toBe('https://web.bible-strong.app/timeline/fr')
    expect(buildWebAppTimelineUrl('en', 'adam')).toBe(
      'https://web.bible-strong.app/timeline/en/adam'
    )
  })

  it('leads to an event through the timeline of its language', () => {
    expect(timelineEventBreadcrumbs('fr', 'Adam')).toEqual([
      { label: 'Chronologie', path: '/timeline/fr' },
      { label: 'Adam' },
    ])
  })
})
