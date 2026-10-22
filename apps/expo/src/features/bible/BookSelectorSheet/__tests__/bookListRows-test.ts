import books from '~assets/bible_versions/books-desc'
import { getBooksForCanon } from '~helpers/bibleBookCatalog'
import { getBookListRows, getTestamentGroups } from '../bookListRows'

const numbers = (group: { books: { Numero: number }[] }) => group.books.map(book => book.Numero)

describe('getTestamentGroups', () => {
  it('splits the canon at the New Testament, deuterocanonical books staying in the Old', () => {
    const groups = getTestamentGroups(getBooksForCanon('catholic-73'), false)

    expect(groups.map(group => group.testament)).toEqual(['old', 'new'])
    expect(numbers(groups[0])).toContain(67)
    expect(numbers(groups[1])[0]).toBe(40)
    expect(groups[0].books.length + groups[1].books.length).toBe(73)
  })

  it('leaves out a testament without books', () => {
    const groups = getTestamentGroups(getBooksForCanon('theotex-septuagint'), false)

    expect(groups.map(group => group.testament)).toEqual(['old'])
  })

  it('keeps one untitled group for books sorted by name', () => {
    const sorted = books.filter(book => book.Numero <= 66).reverse()
    const groups = getTestamentGroups(sorted, true)

    expect(groups).toHaveLength(1)
    expect(groups[0].testament).toBeUndefined()
    expect(groups[0].books).toBe(sorted)
  })
})

describe('getBookListRows', () => {
  it('sets each testament title before its books', () => {
    const genesis = books.find(book => book.Numero === 1)!
    const matthew = books.find(book => book.Numero === 40)!
    const rows = getBookListRows(getTestamentGroups([genesis, matthew], false))

    expect(rows).toEqual([
      { type: 'testament', testament: 'old' },
      { type: 'book', book: genesis },
      { type: 'testament', testament: 'new' },
      { type: 'book', book: matthew },
    ])
  })
})
