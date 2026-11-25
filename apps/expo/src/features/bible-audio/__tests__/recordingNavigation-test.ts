import { getBook as findBook } from '~helpers/bibleBookCatalog'
import { getAdjacentLocation, getFirstCoveredLocation } from '../recordingNavigation'

jest.mock('~helpers/biblesDb', () => ({ getChapterVerseCount: jest.fn() }))

const at = (book: number, chapter: number) => ({ book: findBook(book)!, chapter })
const where = (location: ReturnType<typeof getAdjacentLocation>) =>
  location ? `${location.book.Numero}:${location.chapter}` : null
const proverbsAndJohn = (book: number) => book === 20 || book === 43

describe('getAdjacentLocation', () => {
  it('follows the Bible for a recording of the whole Bible', () => {
    expect(where(getAdjacentLocation(at(20, 31), 'next', undefined, 'protestant-66'))).toBe('21:1')
  })

  it('goes from one book of a partial recording to the next, both ways', () => {
    const next = getAdjacentLocation(
      at(20, 31),
      'next',
      undefined,
      'protestant-66',
      proverbsAndJohn
    )
    expect(where(next)).toBe('43:1')
    const previous = getAdjacentLocation(
      at(43, 1),
      'previous',
      undefined,
      'protestant-66',
      proverbsAndJohn
    )
    expect(where(previous)).toBe('20:31')
    expect(
      where(getAdjacentLocation(at(20, 3), 'next', undefined, 'protestant-66', proverbsAndJohn))
    ).toBe('20:4')
  })

  it('stops after the last chapter and before the first of a partial recording', () => {
    expect(
      getAdjacentLocation(at(43, 21), 'next', undefined, 'protestant-66', proverbsAndJohn)
    ).toBeNull()
    expect(
      getAdjacentLocation(at(20, 1), 'previous', undefined, 'protestant-66', proverbsAndJohn)
    ).toBeNull()
  })
})

describe('getFirstCoveredLocation', () => {
  it('opens the first chapter of the first book covered, in the order of the Bible', () => {
    expect(where(getFirstCoveredLocation([43, 20], undefined, 'protestant-66'))).toBe('20:1')
  })
})
