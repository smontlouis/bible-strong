import books from '~assets/bible_versions/books-desc'

const chapterToReference = (chapters: string[]) => {
  const verses = chapters.map(v => {
    const [book, chapter] = v.split('-').map(i => Number(i))
    return {
      book,
      chapter,
    }
  })

  const title: string = verses
    .map(v => v.chapter)
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
    }, `${books[verses[0].book - 1].Nom} `)

  return title
}

export default chapterToReference
