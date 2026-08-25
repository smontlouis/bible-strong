import { getBook } from '~helpers/bibleBookCatalog'
import i18n from '~i18n'

const range = (start: number, end: number) => {
  return Array(end - start + 1)
    .fill('')
    .map((_, idx) => start + idx)
}

export const chapterToReference = (chapters: string[] | string) => {
  // 3|3-5
  if (typeof chapters === 'string') {
    const [book, numberRange] = chapters.split('|')
    const [startChapter, endChapter] = numberRange.split('-').map(Number)
    const chaptersRange = endChapter
      ? range(startChapter, endChapter).map(n => `${book}-${n}`)
      : [`${book}-${startChapter}`]
    chapters = chaptersRange
  }

  const verses = chapters.map(v => {
    const [book, chapter] = v.split('-').map(i => Number(i))
    return {
      book,
      chapter,
    }
  })

  const title: string = verses
    .map(v => v.chapter)
    .reduce(
      (acc, v, i, array) => {
        if (v === array[i - 1] + 1 && v === array[i + 1] - 1) {
          // if suite > 2
          return acc
        }
        if (v === array[i - 1] + 1 && v !== array[i + 1] - 1) {
          // if endSuite
          return `${acc}-${v}`
        }
        if (array[i - 1] && v - 1 !== array[i - 1]) {
          // if not preceded by - 1
          return `${acc},${v}`
        }
        return acc + v
      },
      `${
        getBook(verses[0].book)?.Nom
          ? i18n.t(getBook(verses[0].book)!.Nom)
          : i18n.t('Livre {{bookNumber}}', { bookNumber: verses[0].book })
      } `
    )

  return title
}

export default chapterToReference
