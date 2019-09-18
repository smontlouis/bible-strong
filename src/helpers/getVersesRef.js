import books from '~assets/bible_versions/books-desc'
import loadBible from '~helpers/loadBible'

const orderVerses = selectedVerses => {
  const orderedVersesList = Object.keys(selectedVerses).sort((key1, key2) => {
    const verse1 = key1.split('-')[2]
    const verse2 = key2.split('-')[2]
    return verse2 < verse1
  })
  return orderedVersesList
}

const getVersesRef = versesList => {
  let versesRef = `${versesList[0]}`
  let previousVerse = versesList[0]
  let isListing = false
  versesList.slice(1).map((verse, index) => {
    if (parseInt(previousVerse) === parseInt(verse) - 1) {
      if (!isListing) {
        versesRef += '-'
        isListing = true
      }
      if (versesList.slice(1).length - 1 === index) versesRef += verse
    } else if (isListing) {
      versesRef += `${previousVerse}, ${verse}`
      isListing = false
    } else {
      versesRef += `, ${verse}`
    }
    previousVerse = verse
  })
  return versesRef
}

export default async (verses, version = 'LSG') => {
  let selectedVerses = verses

  // if 1-1_1
  if (typeof verses === 'string') {
    selectedVerses = { [verses]: true }
  }
  selectedVerses = orderVerses(selectedVerses)

  let toShare = ''
  let reference = ''
  const versesList = []
  let bible = null

  bible = await loadBible(version)

  selectedVerses.map(async (key, index) => {
    const [book, chapter, verse] = key.split('-')
    if (index === 0) reference = `${books[book - 1].Nom} ${chapter}:`
    else toShare += ' '
    toShare += `${bible[book][chapter][verse]}`
    versesList.push(verse)
  })
  reference += getVersesRef(versesList)

  return {
    title: reference || '',
    version,
    content: toShare,
    all: `${toShare} \n${reference} ${version} \n\n https://bible-strong.app`
  }
}
