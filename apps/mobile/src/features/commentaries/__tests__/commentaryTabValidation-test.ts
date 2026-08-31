import { isValidCommentaryVerse } from '../commentaryTabValidation'

describe('isValidCommentaryVerse', () => {
  it('accepts a persisted book-chapter-verse key', () => {
    expect(isValidCommentaryVerse('41-1-1')).toBe(true)
  })

  it.each([undefined, null, '', '41-1', '41-1-0', 'abc-1-1', {}])(
    'rejects incompatible legacy data: %p',
    value => {
      expect(isValidCommentaryVerse(value)).toBe(false)
    }
  )
})
