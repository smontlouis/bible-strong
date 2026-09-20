import { createScopedPassageTab, paletteScopes, isPassageScope } from '../scopes'
import type { SearchEntityResult } from '~features/search/shared/searchResultTypes'

jest.mock('~helpers/generateUUID', () => ({ __esModule: true, default: () => 'scoped-tab' }))
jest.mock('~helpers/bibleVersions', () => ({ versions: { LSG: {}, KJV: {} } }))
jest.mock('~helpers/verseToReference', () => ({
  __esModule: true,
  default: () => 'Genèse 1',
}))
jest.mock('~helpers/bibleBookCatalog', () => ({
  getBook: () => ({ Numero: 1, Nom: 'Genèse', Chapitres: 50 }),
}))
jest.mock('~state/tabs', () => ({
  getDefaultBibleTab: (version: string) => ({ type: 'bible', data: { selectedVersion: version } }),
}))

const passage: SearchEntityResult = {
  id: 'reference:1',
  title: 'Genèse 1:2-5',
  type: 'passages',
  iconType: 'passages',
  referenceSegment: { book: 1, chapter: 1, startVerse: 2, endVerse: 5, isWholeChapter: false },
}

describe('palette scopes', () => {
  it('compares every verse in the selected range', () => {
    expect(createScopedPassageTab('compare', passage, 'LSG')).toMatchObject({
      type: 'compare',
      data: { selectedVerses: { '1-1-2': true, '1-1-3': true, '1-1-4': true, '1-1-5': true } },
    })
  })
  it('opens a chapter without entering focused verse mode', () => {
    const tab = createScopedPassageTab(
      'bible',
      {
        ...passage,
        referenceSegment: {
          book: 1,
          chapter: 1,
          startVerse: 1,
          endVerse: 31,
          isWholeChapter: true,
        },
      },
      'KJV'
    )
    expect(tab).toMatchObject({
      type: 'bible',
      data: {
        selectedVersion: 'KJV',
        selectedVerse: 1,
        contextDisplayMode: 'fullChapter',
        focusVerses: undefined,
      },
    })
  })
  it('searches commentary catalogs rather than treating them as passages', () => {
    expect(isPassageScope(paletteScopes.find(scope => scope.type === 'commentary'))).toBe(false)
  })
  it('does not create a passage tab from an unrelated content result', () => {
    expect(
      createScopedPassageTab('compare', { ...passage, referenceSegment: undefined }, 'LSG')
    ).toBeUndefined()
  })
  it('rejects a Bible version that is not in the application catalog', () => {
    expect(createScopedPassageTab('bible', passage, 'NOT_A_VERSION')).toBeUndefined()
  })
  it('separates passage actions from source filters', () => {
    expect(paletteScopes.filter(isPassageScope).map(scope => scope.type)).toEqual([
      'bible',
      'compare',
    ])
    expect(paletteScopes.find(scope => scope.type === 'study')?.source).toBe('studies')
    expect(paletteScopes.find(scope => scope.type === 'strong')?.source).toBe('strong')
  })
})
