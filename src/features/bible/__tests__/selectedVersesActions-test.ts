import {
  getFirstSelectedVerseLocation,
  parseVerseLocation,
  selectAllChapterVerses,
  selectedVersesIncludeFocus,
} from '../selectedVersesActions'

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
})
