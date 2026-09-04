import { Verse } from '~common/types'
import verseToReference from './verseToReference'

type VerseReference = Pick<Verse, 'Livre' | 'Chapitre' | 'Verset'> & Partial<Pick<Verse, 'Texte'>>
type VerseInput = VerseReference | string | null | undefined

const normalizeVerse = (verse: VerseInput): VerseReference | null => {
  if (!verse) {
    return null
  }

  if (typeof verse === 'string') {
    const [Livre, Chapitre, Verset] = verse.split('-')
    return { Livre, Chapitre, Verset, Texte: '' }
  }

  return verse
}

export default (inputVerses: VerseInput[]) => {
  const verses = inputVerses
    .map(normalizeVerse)
    .filter((verse): verse is VerseReference => Boolean(verse))

  if (!verses.length) {
    return { title: '', content: '' }
  }

  const content = verses.map(v => `${v.Texte}`).join(' ')
  const title = verseToReference(verses.map(v => `${v.Livre}-${v.Chapitre}-${v.Verset}`))

  return { title, content }
}
