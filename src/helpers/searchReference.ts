import books from '~assets/bible_versions/books-desc'
import i18n, { getLanguage } from '~i18n'
import { getDefaultBibleVersion } from '~helpers/languageUtils'
import { getChapterVerseCount } from '~helpers/biblesDb'

export interface VerseBase {
  book: number
  chapter: number
  verse: number
}

export const searchReference = async (ref?: string): Promise<VerseBase | null> => {
  if (!ref) return null
  let reference = ref.trim().toLowerCase()
  const defaultVersion = getDefaultBibleVersion(getLanguage())

  const findBook = books.find(book => reference.includes(i18n.t(book.Nom).toLowerCase()))

  if (!findBook) {
    return null
  }

  if (reference === i18n.t(findBook.Nom).toLowerCase()) {
    return {
      book: findBook.Numero,
      chapter: 1,
      verse: 1,
    }
  }

  const numbers = reference
    .replace(i18n.t(findBook.Nom).toLowerCase(), '')
    .trim()
    .match(/\d+/g)
    ?.map(Number)

  if (!numbers?.length) {
    return null
  }

  const getVerseCount = (bookNum: number, chapter: number): Promise<number> => {
    return getChapterVerseCount(defaultVersion, bookNum, chapter)
  }

  if (numbers.length === 1) {
    if (numbers[0] <= findBook.Chapitres) {
      return {
        book: findBook.Numero,
        chapter: numbers[0],
        verse: 1,
      }
    } else {
      const count = await getVerseCount(findBook.Numero, findBook.Chapitres)

      return {
        book: findBook.Numero,
        chapter: findBook.Chapitres,
        verse: count,
      }
    }
  }

  if (numbers.length > 1) {
    const [chapter, verse] = numbers
    if (chapter <= findBook.Chapitres) {
      const count = await getVerseCount(findBook.Numero, chapter)

      return {
        book: findBook.Numero,
        chapter,
        verse: verse > count ? count : verse,
      }
    } else {
      return null
    }
  }

  return null
}
