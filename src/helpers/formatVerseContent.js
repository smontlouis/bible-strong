import books from '~assets/bible_versions/books-desc'

export default verses => {
  if (!verses.length) {
    return { title: '', content: '' }
  }

  const content: string = verses.map(v => `${v.Texte}`).join(' ')

  const title: string = verses
    .map(v => Number(v.Verset))
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
    }, `${books[Number(verses[0].Livre) - 1].Nom} ${verses[0].Chapitre}:`)

  return { title, content }
}
