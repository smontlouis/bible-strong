import { getBook, getBookCorpus, getBooksForCanon, isBookInTestament } from '../bibleBookCatalog'

describe('bibleBookCatalog', () => {
  it('exposes stable identities for the seven deuterocanonical books', () => {
    expect(getBook(67)?.Nom).toBe('Tobie')
    expect(getBook(73)?.Nom).toBe('2 Maccabées')
    expect(getBookCorpus(67)).toBe('deuterocanonical')
  })

  it('keeps the Protestant canon limited to the existing 66 books', () => {
    const books = getBooksForCanon('protestant-66')

    expect(books).toHaveLength(66)
    expect(books.at(-1)?.Numero).toBe(66)
  })

  it('orders stable book identities according to the Clementine canon', () => {
    const bookNumbers = getBooksForCanon('clementine-vulgate').map(book => book.Numero)

    expect(bookNumbers.slice(14, 19)).toEqual([15, 16, 67, 68, 17])
    expect(bookNumbers.slice(43, 48)).toEqual([39, 72, 73, 40, 41])
  })

  it('orders stable book identities according to the modern Catholic canon', () => {
    const bookNumbers = getBooksForCanon('catholic-73').map(book => book.Numero)

    expect(bookNumbers).toHaveLength(73)
    expect(bookNumbers.slice(14, 23)).toEqual([15, 16, 67, 68, 17, 72, 73, 18, 19])
    expect(bookNumbers.slice(25, 32)).toEqual([22, 69, 70, 23, 24, 25, 71])
  })

  it('filters installed coverage without losing the canon order', () => {
    const books = getBooksForCanon('clementine-vulgate', [40, 17, 68, 1, 67])

    expect(books.map(book => book.Numero)).toEqual([1, 67, 68, 17, 40])
  })

  it('treats deuterocanonical books as Old Testament books', () => {
    expect(isBookInTestament(67, 'old')).toBe(true)
    expect(isBookInTestament(67, 'new')).toBe(false)
    expect(getBookCorpus(40)).toBe('new')
  })
})
