import { getBookmarkVerse } from '../bookmarkVerse'

describe('bookmark verse compatibility', () => {
  it('accepts numeric verses and serialized verse numbers', () => {
    expect(getBookmarkVerse(17)).toBe(17)
    expect(getBookmarkVerse('17')).toBe(17)
  })

  it.each([undefined, null, {}, { verse: 17 }, '', 'word', 0, -1, 1.5, Infinity])(
    'falls back to the chapter for an invalid stored verse: %p',
    value => expect(getBookmarkVerse(value)).toBeUndefined()
  )
})
