import { naveHtmlInBible, naveTargetInBible, parseNaveVerseTarget } from '../naveBibleNumbering'

jest.mock('~i18n', () => ({
  __esModule: true,
  default: { t: (key: string) => key },
  t: (key: string) => key,
}))

const target = (value: string) => parseNaveVerseTarget(value)!

describe('Nave verse links in the reader’s numbering', () => {
  it('opens Nave Malachi 4:5 at LSG Malachi 3:23', () => {
    expect(naveTargetInBible(target('39-4-5'), 'fr', 'LSG')).toEqual([
      { book: 39, chapter: 3, verses: [23] },
    ])
  })

  it('opens Nave Psalm 51:1 at LSG 51:3, past the title', () => {
    expect(naveTargetInBible(target('19-51-1'), 'fr', 'LSG')).toEqual([
      { book: 19, chapter: 51, verses: [3] },
    ])
    expect(naveTargetInBible(target('19-51-1,2'), 'fr', 'LSG')).toEqual([
      { book: 19, chapter: 51, verses: [3, 4] },
    ])
  })

  it('keeps KJV-numbered Bibles and unknown numberings as written', () => {
    expect(naveTargetInBible(target('39-4-5'), 'en', 'KJV')).toEqual([target('39-4-5')])
    expect(naveTargetInBible(target('19-51-1'), 'fr', 'UNKNOWN')).toEqual([target('19-51-1')])
  })

  it('splits a list crossing a chapter of the Bible', () => {
    expect(naveTargetInBible(target('4-16-35,36,37'), 'fr', 'LSG')).toEqual([
      { book: 4, chapter: 16, verses: [35] },
      { book: 4, chapter: 17, verses: [1, 2] },
    ])
  })

  it('maps whole chapters', () => {
    expect(naveTargetInBible(target('29-3'), 'fr', 'LSG')).toEqual([
      { book: 29, chapter: 4, verses: [] },
    ])
    expect(naveTargetInBible(target('39-4'), 'fr', 'LSG')).toEqual([
      { book: 39, chapter: 3, verses: [19, 20, 21, 22, 23, 24] },
    ])
    expect(naveTargetInBible(target('40-3'), 'fr', 'LSG')).toEqual([target('40-3')])
  })

  it('rewrites only the links whose verses change', () => {
    const html =
      '<p><a href="v=40-4-17">Matthieu 4:17</a>; <a href="v=39-4-5,6">Malachie 4:5-6</a></p>'
    expect(naveHtmlInBible(html, 'fr', 'LSG')).toBe(
      '<p><a href="v=40-4-17">Matthieu 4:17</a>; <a href="v=39-3-23,24">Malachie 3:23-24</a></p>'
    )
    expect(naveHtmlInBible(html, 'en', 'KJV')).toBe(html)
    expect(naveHtmlInBible(html, 'fr', 'KJV')).toBe(html)
  })

  it('converts once: a rewritten link is not read again as a Nave one', () => {
    const once = naveHtmlInBible('<a href="v=19-51-1">Psaumes 51:1</a>', 'fr', 'LSG')
    expect(once).toBe('<a href="v=19-51-3">Psaumes 51:3</a>')
  })
})
