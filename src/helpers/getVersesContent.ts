import { VerseIds, VerseRefContent } from '~common/types'
import { getMultipleVerses } from '~helpers/biblesDb'
import { VersionCode } from '../state/tabs'
import verseToReference from './verseToReference'
import * as Sentry from '@sentry/react-native'

const orderVerses = (verses: VerseIds) => {
  const orderedVersesList = Object.keys(verses).sort((key1, key2) => {
    const [book1, chapter1, verse1] = key1.split('-').map(Number)
    const [book2, chapter2, verse2] = key2.split('-').map(Number)
    return book1 - book2 || chapter1 - chapter2 || verse1 - verse2
  })

  return orderedVersesList
}

export default async ({
  verses,
  version = 'LSG',
  hasVerseNumbers = false,
  hasInlineVerses = true,
  hasQuotes = false,
  hasAppName = true,
  position,
}: {
  verses: string | VerseIds
  version?: VersionCode
  hasVerseNumbers?: boolean
  hasInlineVerses?: boolean
  hasQuotes?: boolean
  hasAppName?: boolean
  position?: number
}): Promise<VerseRefContent> => {
  let verseIds = verses
  // if 1-1_1
  if (typeof verseIds === 'string') {
    verseIds = { [verseIds]: true }
  }

  const selectedVerses = orderVerses(verseIds)

  let versesContent = ''
  let reference = verseToReference(selectedVerses)

  const versesMap = await getMultipleVerses(version, selectedVerses)

  for (let index = 0; index < selectedVerses.length; index++) {
    const key = selectedVerses[index]
    try {
      const [, , verse] = key.split('-')
      const text = versesMap[key]
      if (!text) throw new Error('Verse not found')
      const inlineVerseContent = hasInlineVerses && index !== selectedVerses.length - 1 ? '' : '\n'
      const verseNumberContent = hasVerseNumbers ? `${verse}. ` : ''
      const quoteStartContent = hasQuotes && index === 0 ? '« ' : ''
      const quoteEndContent = hasQuotes && index === selectedVerses.length - 1 ? ' »' : ''

      versesContent += `${quoteStartContent}${verseNumberContent}${text}${quoteEndContent}${inlineVerseContent} `
    } catch (e) {
      if (version !== 'POV') {
        Sentry.withScope(scope => {
          const [book, chapter, verse] = key.split('-')
          scope.setExtra('reference', `${reference} ${version}`)
          scope.setExtra('failedVerseKey', key)
          scope.setExtra('book', book)
          scope.setExtra('chapter', chapter)
          scope.setExtra('verse', verse)
          scope.setExtra('version', version)
          scope.setExtra('allSelectedVerses', selectedVerses)
          scope.setExtra('versesMapKeys', Object.keys(versesMap))
          Sentry.captureException(e)
        })
      }
      versesContent = 'Impossible de charger ce verset.'
    }
  }

  return {
    title: reference || '',
    version,
    content: versesContent,
    all: `${versesContent} \n${reference} ${version} ${
      hasAppName ? '\n\nhttps://bible-strong.app' : ''
    }`,
  }
}
