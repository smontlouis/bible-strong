import { VerseIds, VerseRefContent } from '~common/types'
import { VersionCode } from '../state/tabs'
import verseToReference from './verseToReference'
import { appLogger } from '~helpers/agentObservability'

export type LoadVerseTexts = (
  version: string,
  verseKeys: string[]
) => Promise<Record<string, string>>

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
  position,
  loadVerseTexts,
}: {
  verses: string | VerseIds
  version?: VersionCode
  hasVerseNumbers?: boolean
  hasInlineVerses?: boolean
  hasQuotes?: boolean
  position?: number
  loadVerseTexts: LoadVerseTexts
}): Promise<VerseRefContent> => {
  let verseIds = verses
  // if 1-1_1
  if (typeof verseIds === 'string') {
    verseIds = { [verseIds]: true }
  }

  const selectedVerses = orderVerses(verseIds)

  let versesContent = ''
  let reference = verseToReference(selectedVerses)

  const versesMap = await loadVerseTexts(version, selectedVerses)
  const loadedVerses = selectedVerses.filter(key => versesMap[key])
  const missingVerses = selectedVerses.filter(key => !versesMap[key])

  if (missingVerses.length > 0 && version !== 'POV') {
    // A version can lack a verse of the selection (its versification differs): only that verse
    // is left out.
    appLogger.warn('database', 'verse_content.missing', {
      versionId: version,
      missingVerses,
      selectedVerseCount: selectedVerses.length,
      loadedVerseCount: loadedVerses.length,
    })
  }

  if (loadedVerses.length === 0) {
    if (version !== 'POV') {
      appLogger.captureError('database', 'verse_content.missing', new Error('Verse not found'), {
        versionId: version,
        missingVerses,
        selectedVerseCount: selectedVerses.length,
      })
    }
    versesContent = 'Impossible de charger ce verset.'
  }

  loadedVerses.forEach((key, index) => {
    const [, , verse] = key.split('-')
    const text = versesMap[key]
    const isLast = index === loadedVerses.length - 1
    const inlineVerseContent = hasInlineVerses && !isLast ? '' : '\n'
    const verseNumberContent = hasVerseNumbers ? `${verse}. ` : ''
    const quoteStartContent = hasQuotes && index === 0 ? '« ' : ''
    const quoteEndContent = hasQuotes && isLast ? ' »' : ''

    versesContent += `${quoteStartContent}${verseNumberContent}${text}${quoteEndContent}${inlineVerseContent} `
  })

  return {
    title: reference || '',
    version,
    content: versesContent,
    all: `${versesContent} \n${reference} ${version}`,
  }
}
