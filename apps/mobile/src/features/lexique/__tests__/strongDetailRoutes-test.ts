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
    ['index', '/strong'],
    ['entity', '/strong/entity'],
    ['dictionary', '/strong/dictionary'],
    ['related', '/strong/related'],
    ['concordance', '/strong/concordance'],
  ] as const)('creates the %s route with the complete Strong context', (page, pathname) => {
    expect(
      createStrongDetailRoute(page, context, {
        entityKey: page === 'entity' ? 'Peter@Matt.4.18' : undefined,
      })
    ).toEqual({
      pathname,
      params: {
        book: '40',
        reference: 'G4074G',
        identityKind: 'dstrong',
        identityCode: 'G4074G',
        bibleVersion: 'LSG',
        clickedWord: 'Pierre',
        bibleChapter: '16',
        bibleVerse: '18',
        morphologyCodes: JSON.stringify(['GNcmsn']),
        ...(page === 'entity' ? { entityKey: 'Peter@Matt.4.18' } : {}),
      },
    })
  })

  it('restores the Strong context from route parameters', () => {
    const route = createStrongDetailRoute('entity', context, {
      entityKey: 'Peter@Matt.4.18',
    })

    expect(parseStrongDetailRouteParams(route.params)).toEqual({
      context,
      entityKey: 'Peter@Matt.4.18',
    })
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
})
