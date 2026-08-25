import {
  getSelectedVerseKeys,
  getSelectedVersesBookmarkLocation,
  getSelectedVersesFocusAction,
  getSelectedVersesLinkParams,
  getSelectedVersesRelationEndpoint,
  getSelectedVersesStudyPayload,
  getFirstSelectedVerseLocation,
  parseVerseLocation,
  selectAllChapterVerses,
  selectedVersesIncludeFocus,
} from '../selectedVersesActions'
import { endpointIdentity } from '~features/studyRelations/domain'

jest.mock('~assets/bible_versions/books-desc', () => [{ Numero: 1, Nom: 'Genèse', Chapitres: 50 }])

jest.mock('~i18n', () => ({
  __esModule: true,
  default: {
    t: (key: string) => key,
  },
  t: (key: string) => key,
}))

describe('selectedVersesActions', () => {
  it('selects all verses from a chapter', () => {
    expect(
      selectAllChapterVerses([
        { Livre: 1, Chapitre: 1, Verset: 1 },
        { Livre: 1, Chapitre: 1, Verset: 2 },
      ])
    ).toEqual({
      '1-1-1': true,
      '1-1-2': true,
    })
  })

  it('parses a verse key into a location', () => {
    expect(parseVerseLocation('2-3-4')).toEqual({ book: 2, chapter: 3, verse: 4 })
  })

  it('returns null for an invalid verse key', () => {
    expect(parseVerseLocation('bad-key')).toBeNull()
  })

  it('returns the first selected verse location', () => {
    expect(getFirstSelectedVerseLocation({ '1-2-3': true, '1-2-4': true })).toEqual({
      book: 1,
      chapter: 2,
      verse: 3,
    })
  })

  it('detects whether selected verses include a focused verse', () => {
    expect(selectedVersesIncludeFocus({ '1-1-3': true }, [2, 3])).toBe(true)
    expect(selectedVersesIncludeFocus({ '1-1-4': true }, [2, 3])).toBe(false)
  })

  it('returns selected Verse keys as the workflow identity', () => {
    expect(getSelectedVerseKeys({ '1-1-1': true, '1-1-2': true })).toEqual(['1-1-1', '1-1-2'])
  })

  it('builds Link route params from selected verses', () => {
    expect(getSelectedVersesLinkParams({ '1-1-1': true, '1-1-2': true })).toEqual({
      verseKeys: '1-1-1,1-1-2',
    })
  })

  it('preserves the source version for Link and Relation creation', () => {
    expect(getSelectedVersesLinkParams({ '67-1-1': true }, 'VUL')).toEqual({
      verseKeys: '67-1-1',
      version: 'VUL',
    })

    expect(getSelectedVersesRelationEndpoint({ '67-1-1': true }, 'VUL')).toMatchObject({
      type: 'verse',
      verseKeys: ['67-1-1'],
      version: 'VUL',
    })
  })

  it('builds Study payload verse keys from selected verses', () => {
    expect(getSelectedVersesStudyPayload({ '1-1-1': true, '1-1-2': true })).toEqual([
      '1-1-1',
      '1-1-2',
    ])
  })

  it('builds a Verse Relation endpoint from selected verses', () => {
    const endpoint = getSelectedVersesRelationEndpoint({ '1-1-2': true, '1-1-1': true })

    expect(endpoint && endpointIdentity(endpoint)).toBe('verse:1-1-1/1-1-2')
  })

  it('returns null for empty Relation endpoint selection', () => {
    expect(getSelectedVersesRelationEndpoint({})).toBeNull()
  })

  it('chooses whether to clear focus or pin selected verses', () => {
    expect(getSelectedVersesFocusAction({ '1-1-3': true }, [3])).toBe('clear-focus')
    expect(getSelectedVersesFocusAction({ '1-1-4': true }, [3])).toBe('pin-selected')
  })

  it('uses the first selected Verse as the Bookmark location', () => {
    expect(getSelectedVersesBookmarkLocation({ '2-3-4': true })).toEqual({
      book: 2,
      chapter: 3,
      verse: 4,
    })
  })
})
