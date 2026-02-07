import { bcv_parser } from 'bible-passage-reference-parser/esm/bcv_parser.js'
import * as en from 'bible-passage-reference-parser/esm/lang/en.js'
import * as fr from 'bible-passage-reference-parser/esm/lang/fr.js'

// import structuredClone from '@ungap/structured-clone'
import { getLanguage } from '../../i18n'

// if (!('structuredClone' in globalThis)) {
//   globalThis.structuredClone = structuredClone
// }

const language = getLanguage()

export const bcv: any = new bcv_parser(language === 'fr' ? fr : en)

bcv.set_options({
  consecutive_combination_strategy: 'separate',
  sequence_combination_strategy: 'separate',
})

type BookID = string

const trans = 'default'
const bookOrder: BookID[] = []

function getBookOrder(): void {
  if (bookOrder.length > 0) return

  const order = bcv.translations.systems[trans].order
  for (const book in order) {
    const sortOrder = order[book]
    bookOrder[sortOrder] = book
  }
}

function getLastVerseInChapter(book: BookID, chapter: number): number {
  return bcv.translations.systems[trans].chapters[book][chapter - 1]
}

function getLastChapterInBook(book: BookID): number {
  return bcv.translations.systems[trans].chapters[book].length
}

export function getIntermediateChapters(startRef: string, endRef: string) {
  const [startBook, startChapterStr, startVerseStr] = startRef.split('.')
  const [endBook, endChapterStr, endVerseStr] = endRef.split('.')

  const startChapter = parseInt(startChapterStr, 10)
  const endChapter = parseInt(endChapterStr, 10)
  const startVerse = startVerseStr ? parseInt(startVerseStr, 10) : null
  const endVerse = endVerseStr ? parseInt(endVerseStr, 10) : null

  if (startBook !== endBook) {
    throw new Error('Multi-book range not supported in this version')
  }

  const results: string[] = []

  // Cas 1 : premier chapitre, partiel ou complet
  if (startVerse) {
    const lastVerse = getLastVerseInChapter(startBook, startChapter)
    results.push(
      `${startBook}.${startChapter}.${startVerse}-${startBook}.${startChapter}.${lastVerse}`
    )
  } else {
    results.push(`${startBook}.${startChapter}`)
  }

  // Cas 2 : chapitres intermédiaires entiers
  for (let c = startChapter + 1; c < endChapter; c++) {
    results.push(`${startBook}.${c}`)
  }

  // Cas 3 : dernier chapitre, partiel ou complet
  if (endChapter > startChapter) {
    if (endVerse) {
      results.push(`${startBook}.${endChapter}.1-${startBook}.${endChapter}.${endVerse}`)
    } else {
      results.push(`${startBook}.${endChapter}`)
    }
  }

  return results
}

export const parseResponse = (res: string) => {
  const str: string = bcv.parse(res).osis()

  const parsedArray = str
    .split(',')
    .map(s => {
      const [startRef, endRef] = s.split('-')

      if (!endRef) {
        return s
      }

      const [sb, sc, sv] = startRef.split('.')
      const [eb, ec, ev] = endRef.split('.')

      if (sb !== eb) {
        return undefined
      }

      if (sc !== ec) {
        return getIntermediateChapters(startRef, endRef)
      }

      return s
    })
    .filter(Boolean)
    .flat()
    .map(s => {
      const [startRef, endRef] = s.split('-')
      const [sb, sc, sv] = startRef.split('.')
      const [eb, ec, ev] = endRef?.split('.') || []

      const sbNum = bcv.translations.systems[trans].order[sb]

      if (!sc) {
        return undefined
      }

      if (!sv) {
        return `${sbNum}_${sc}`
      }

      if (!ev) {
        return `${sbNum}_${sc}:${sv}`
      }

      return `${sbNum}_${sc}:${sv}-${ev}`
    })
    .join(',')

  return { original: str, parsed: parsedArray }
}
