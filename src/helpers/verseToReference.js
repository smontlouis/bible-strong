import books from '~assets/bible_versions/books-desc'

const orderVerses = arrayVerses => {
  const orderedVersesList = arrayVerses.sort((key1, key2) => {
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
const verseToReference = (v, options = {}) => {
  let verses = v

  // Needs a special extraction
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

  verses = orderVerses(verses)

  verses = verses.map(v => {
    const [book, chapter, verse] = v.split('-').map(i => Number(i))
    return {
      book,
      chapter,
      verse,
    }
  })

  const title: string = verses
    .map(v => v.verse)
    .reduce((acc, v, i, array) => {
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
    }, `${books[verses[0].book - 1].Nom} ${verses[0].chapter}:`)

  return title
}

export default verseToReference
