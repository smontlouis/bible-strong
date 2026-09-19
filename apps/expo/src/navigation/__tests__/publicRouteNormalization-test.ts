import { getBook } from '~helpers/bibleBookCatalog'
import { normalizePublicRoute } from '../publicRouteNormalization'

jest.mock('react-native-url-polyfill/auto', () => ({}))
jest.mock('~i18n', () => ({ getLanguage: () => 'fr' }))

jest.mock('~helpers/bibleVersions', () => ({
  versions: { LSG: { id: 'LSG' }, NBS: { id: 'NBS' } },
}))

describe('public route normalization', () => {
  it('normalizes a legacy Bible chapter using the current default version', () => {
    expect(
      normalizePublicRoute(
        {
          pathname: '/bible-view',
          params: { book: JSON.stringify(getBook(43)), chapter: '3' },
        },
        'LSG'
      )
    ).toEqual({ pathname: '/bible/lsg/john/3' })
  })

  it('normalizes focused Strong and reverse-interlinear passages', () => {
    expect(
      normalizePublicRoute(
        {
          pathname: '/bible-view',
          params: {
            book: '43',
            chapter: '3',
            verse: '16',
            focusVerses: '[16,17,18]',
            contextDisplayMode: 'focused',
            version: 'LSG',
            strongMode: 'reverse-interlinear',
          },
        },
        'NBS'
      )
    ).toEqual({ pathname: '/bible/lsg/reverse-interlinear/john/3/16-18' })
  })

  it('keeps legacy Bible routes whose state is not represented publicly', () => {
    const annotation = {
      pathname: '/bible-view',
      params: { book: '43', chapter: '3', annotationId: 'annotation' },
    }
    const disjoint = {
      pathname: '/bible-view',
      params: {
        book: '43',
        chapter: '3',
        focusVerses: '[16,18]',
        contextDisplayMode: 'focused',
      },
    }
    expect(normalizePublicRoute(annotation, 'LSG')).toBe(annotation)
    expect(normalizePublicRoute(disjoint, 'LSG')).toBe(disjoint)
  })

  it('normalizes a legacy Strong route', () => {
    expect(
      normalizePublicRoute(
        { pathname: '/strong', params: { book: '40', reference: '3056' } },
        'LSG'
      )
    ).toEqual({ pathname: '/strong/g3056', params: {} })
    expect(
      normalizePublicRoute(
        { pathname: '/strong/dictionary', params: { book: '1', reference: '430' } },
        'LSG'
      )
    ).toEqual({ pathname: '/strong/h0430/dictionary', params: {} })
    expect(
      normalizePublicRoute(
        { pathname: '/strong/entity', params: { entityKey: 'Peter@Matt.4.18' } },
        'LSG'
      )
    ).toEqual({ pathname: '/strong/entity/Peter%40Matt.4.18', params: {} })
  })

  it('normalizes a Nave topic with an explicit or default resource language', () => {
    expect(
      normalizePublicRoute(
        { pathname: '/nave-detail', params: { name_lower: 'bonté', language: 'fr' } },
        'LSG',
        'en'
      )
    ).toEqual({ pathname: '/nave/fr/bont%C3%A9' })
    expect(
      normalizePublicRoute(
        { pathname: '/nave-detail', params: { name_lower: 'patience' } },
        'KJV',
        'en'
      )
    ).toEqual({ pathname: '/nave/en/patience' })
  })

  it('normalizes a dictionary article when its exact ID and label are known', () => {
    expect(
      normalizePublicRoute(
        {
          pathname: '/dictionnary-detail',
          params: { language: 'fr', work: 'westphal', entryId: '42', word: 'Saint-Esprit' },
        },
        'LSG'
      )
    ).toEqual({ pathname: '/dictionary/fr/westphal/42/saint-esprit' })

    const legacy = {
      pathname: '/dictionnary-detail',
      params: { language: 'fr', work: 'westphal', entryId: '42' },
    }
    expect(normalizePublicRoute(legacy, 'LSG')).toBe(legacy)
  })

  it('normalizes timeline landing pages and events with the resource language', () => {
    expect(normalizePublicRoute({ pathname: '/timeline-home' }, 'LSG', 'fr', 'en')).toEqual({
      pathname: '/timeline/en',
    })
    expect(
      normalizePublicRoute(
        { pathname: '/event', params: { slug: 'Birth-of-Moses' } },
        'LSG',
        'fr',
        'en'
      )
    ).toEqual({ pathname: '/timeline/en/birth-of-moses' })
    expect(
      normalizePublicRoute(
        { pathname: '/event', params: { slug: 'moise', language: 'fr' } },
        'LSG',
        'en',
        'en'
      )
    ).toEqual({ pathname: '/timeline/fr/moise' })
  })

  it('normalizes commentary chapters and deterministic sections', () => {
    expect(
      normalizePublicRoute(
        {
          pathname: '/commentary-chapter',
          params: { projectionId: 'barnes:fr', book: '43', chapter: '3' },
        },
        'LSG'
      )
    ).toEqual({ pathname: '/commentary/fr/barnes/john/3' })
    expect(
      normalizePublicRoute(
        {
          pathname: '/commentary-entry',
          params: {
            projectionId: 'barnes:fr',
            book: '43',
            chapter: '3',
            sectionId: 'barnes-fr-43-3-16-18',
          },
        },
        'LSG'
      )
    ).toEqual({ pathname: '/commentary/fr/barnes/john/3/16-18' })
  })
})
