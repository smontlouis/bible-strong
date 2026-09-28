import {
  createStrongDetailRoute,
  parseStrongDetailRouteParams,
  type StrongDetailRouteContext,
} from '../strongDetailRoutes'

const context: StrongDetailRouteContext = {
  book: 40,
  reference: 'G4074G',
  identityKind: 'dstrong',
  identityCode: 'G4074G',
  bibleVersion: 'LSG',
  clickedWord: 'Pierre',
  bibleChapter: 16,
  bibleVerse: 18,
  morphologyCodes: ['GNcmsn'],
}

describe('Strong detail routes', () => {
  it.each([
    ['index', '/strong/g4074g'],
    ['entity', '/strong/entity/Peter%40Matt.4.18'],
    ['dictionary', '/strong/g4074g/dictionary'],
    ['related', '/strong/g4074g/related'],
    ['concordance', '/strong/g4074g/concordance'],
  ] as const)('creates the %s route with the complete Strong context', (page, pathname) => {
    const route = createStrongDetailRoute(page, context, {
      entityKey: page === 'entity' ? 'Peter@Matt.4.18' : undefined,
    })
    expect(route).toEqual({
      pathname,
      params: {
        book: '40',
        bibleVersion: 'LSG',
        clickedWord: 'Pierre',
        bibleChapter: '16',
        bibleVerse: '18',
        morphologyCodes: JSON.stringify(['GNcmsn']),
      },
    })
  })

  it('keeps only contextual presentation parameters outside the path identity', () => {
    const route = createStrongDetailRoute('entity', context, {
      entityKey: 'Peter@Matt.4.18',
    })

    expect(parseStrongDetailRouteParams(route.params)).toEqual({
      context: {
        book: 40,
        bibleVersion: 'LSG',
        clickedWord: 'Pierre',
        bibleChapter: 16,
        bibleVerse: 18,
        morphologyCodes: ['GNcmsn'],
      },
      entityKey: undefined,
    })
  })

  it('keeps the book of a context verse outside Matthew', () => {
    const route = createStrongDetailRoute('index', {
      book: 45,
      identityKind: 'dstrong',
      identityCode: 'G0266',
      bibleVersion: 'KJV',
      bibleChapter: 6,
      bibleVerse: 23,
    })

    expect(route).toEqual({
      pathname: '/strong/g0266',
      params: { book: '45', bibleVersion: 'KJV', bibleChapter: '6', bibleVerse: '23' },
    })
  })

  it('omits the book from a public route without a context verse', () => {
    expect(
      createStrongDetailRoute('index', {
        book: 40,
        identityKind: 'dstrong',
        identityCode: 'G0266',
      })
    ).toEqual({ pathname: '/strong/g0266', params: {} })
  })

  it('supports an autonomous entity route without a Strong identity', () => {
    expect(parseStrongDetailRouteParams({ entityKey: 'Peter@Matt.4.18' })).toEqual({
      context: {},
      entityKey: 'Peter@Matt.4.18',
    })
  })

  it('ignores malformed serialized morphology instead of breaking the route', () => {
    expect(
      parseStrongDetailRouteParams({
        book: '40',
        reference: 'G4074G',
        morphologyCodes: '{broken',
      })
    ).toEqual({
      context: {
        book: 40,
        reference: 'G4074G',
      },
      entityKey: undefined,
    })
  })

  it('keeps the legacy route for an identity that cannot be represented publicly', () => {
    expect(createStrongDetailRoute('index', { book: 1, reference: 'unknown' })).toEqual({
      pathname: '/strong',
      params: { book: '1', reference: 'unknown' },
    })
  })
})
