import books from '~assets/bible_versions/books-desc'

// 1-1-1 => Genèse 1:1 || [1-1-1, 1-1-3, 1-1-4, 1-1-5] => Genèse 1:1,3-5
const verseToReference = v => {
  let verses = v

  if (typeof verses === 'string') {
    verses = [v]
  }

  verses = verses.map(v => {
    const [book, chapter, verse] = v.split('-').map(i => Number(i))
    return {
      book,
      chapter,
      verse
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
