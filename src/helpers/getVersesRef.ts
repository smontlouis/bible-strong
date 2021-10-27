import books from '~assets/bible_versions/books-desc'
import { VerseRefContent } from '~common/types'
import loadBible from '~helpers/loadBible'
import i18n from '~i18n'

const orderVerses = verses => {
  const orderedVersesList = Object.keys(verses).sort((key1, key2) => {
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
      if (versesList.slice(1).length - 1 === index) {
        versesRef += verse
      }
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

export default async (
  verses,
  version = 'LSG',
  withVerseNumber,
  position
): Promise<VerseRefContent> => {
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

  bible = await loadBible(version, position)

  selectedVerses.map(async (key, index) => {
    const [book, chapter, verse] = key.split('-')
    if (index === 0) {
      reference = `${i18n.t(books[book - 1].Nom)} ${chapter}:`
    } else {
      toShare += ' '
    }
    try {
      toShare += `${withVerseNumber ? `\n${verse}. ` : ''}${
        bible[book][chapter][verse]
      }`
    } catch {
      toShare = 'Impossible de charger ce verset.'
    }
    versesList.push(verse)
  })
  reference += getVersesRef(versesList)

  return {
    title: reference || '',
    version,
    content: toShare,
    all: `${toShare} \n${reference} ${version} \n\n https://bible-strong.app`,
  }
}
