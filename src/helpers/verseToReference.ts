import books from '~assets/bible_versions/books-desc'
import i18n from '~i18n'

const orderVerses = (arrayVerses: any) => {
  const orderedVersesList = arrayVerses.sort((key1: any, key2: any) => {
    const verse1 = Number(key1.split('-')[2])
    const verse2 = Number(key2.split('-')[2])

    if (verse1 < verse2) {
      return -1
    }
    if (verse1 > verse2) {
      return 1
    }
    return 0
  })

  return orderedVersesList
}

const range = (start: number, end: number) => {
  return Array(end - start + 1)
    .fill('')
    .map((_, idx) => start + idx)
}

// 1-1-1
// [1-1-1, 1-1-3, 1-1-4, 1-1-5]   => Genèse 1:1,3-5
// {1-1-1: true, 1-1-2: true}
const verseToReference = (v: any, options: any = {}) => {
  if (!v || !Object.keys(v).length) return ''

  let verses = v

  // Needs a special extraction
  // @ts-ignore
  if (options.isPlan) {
    const [book, rest] = v.split('|')
    const [chapter, numberRange] = rest.split(':')
    const [startVerse, endVerse] = numberRange.split('-').map(Number)
    const versesRange = endVerse
      ? range(startVerse, endVerse).map(n => `${book}-${chapter}-${n}`)
      : [`${book}-${chapter}-${startVerse}`]
    verses = versesRange
  }

  if (typeof verses === 'object' && !Array.isArray(verses)) {
    verses = Object.keys(v)
  } else if (typeof verses === 'string') {
    verses = [v]
  }

  if (!verses.length) {
    return ''
  }

  verses = orderVerses(verses)

  verses = verses.map((v: any) => {
    const [book, chapter, verse] = v.split('-').map((i: any) => Number(i))
    return {
      book,
      chapter,
      verse,
    }
  })

  const title: string = verses
    .map((v: any) => v.verse)
    .reduce(
      (acc: any, v: any, i: any, array: any) => {
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
      `${i18n.t(books[verses[0].book - 1].Nom)} ${verses[0].chapter}:`
    )

  return title
}

export default verseToReference
