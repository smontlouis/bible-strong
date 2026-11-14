import { getEntityCardBackdropUri, parseEntityCardCatalog } from '../entityCards'

const published = {
  version: 1,
  cards: [
    { id: 'Abraham@Gen.11.26-1Pe', entity: 'Abraham@Gen.11.26-1Pe', backdrop: 'nuit-etoilee' },
    {
      id: 'Abraham@Gen.11.26-1Pe~abram',
      entity: 'Abraham@Gen.11.26-1Pe',
      backdrop: 'chemin-collines',
    },
    { id: 'LORD@Gen.1.1-Rev', entity: 'LORD@Gen.1.1-Rev', backdrop: null },
    { id: 'Sarah@Gen.11.29-1Pe', entity: 'Sarah@Gen.11.29-1Pe', backdrop: 'not-painted' },
    'not a card',
  ],
  backdrops: {
    'nuit-etoilee': { hash: '0123456789ab' },
    'chemin-collines': { hash: 'abcdef012345' },
    'bad-hash': { hash: 'nope' },
  },
}

describe('entity cards', () => {
  it('keeps the backdrop of each card that has a painted one', () => {
    expect(parseEntityCardCatalog(published)).toEqual({
      cards: {
        'Abraham@Gen.11.26-1Pe': 'nuit-etoilee',
        'Abraham@Gen.11.26-1Pe~abram': 'chemin-collines',
      },
      backdrops: { 'nuit-etoilee': '0123456789ab', 'chemin-collines': 'abcdef012345' },
    })
  })

  it('refuses a catalog of another version', () => {
    expect(parseEntityCardCatalog({ ...published, version: 2 })).toBeUndefined()
    expect(parseEntityCardCatalog(null)).toBeUndefined()
  })

  it('addresses the backdrop of a card, of a stage, or of its character', () => {
    const catalog = parseEntityCardCatalog(published)
    expect(getEntityCardBackdropUri(catalog, 'Abraham@Gen.11.26-1Pe')).toBe(
      'https://media.bible-strong.app/entity-cards/backdrops/nuit-etoilee/0123456789ab/w768.webp'
    )
    expect(getEntityCardBackdropUri(catalog, 'Abraham@Gen.11.26-1Pe', 'abram', 'w384')).toMatch(
      /\/chemin-collines\/abcdef012345\/w384\.webp$/
    )
    expect(getEntityCardBackdropUri(catalog, 'Abraham@Gen.11.26-1Pe', 'unknown')).toMatch(
      /\/nuit-etoilee\//
    )
    expect(getEntityCardBackdropUri(catalog, 'LORD@Gen.1.1-Rev')).toBeUndefined()
    expect(getEntityCardBackdropUri(undefined, 'Abraham@Gen.11.26-1Pe')).toBeUndefined()
  })
})
