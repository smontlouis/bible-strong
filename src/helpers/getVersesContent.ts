import { VerseIds, VerseRefContent } from '~common/types'
import loadBible from '~helpers/loadBible'
import { VersionCode } from '~state/tabs'
import verseToReference from './verseToReference'

const orderVerses = (verses: VerseIds) => {
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

export default async ({
  verses,
  version = 'LSG',
  hasVerseNumbers = false,
  hasInlineVerses = true,
  hasQuotes = false,
  hasAppName = true,
  position,
}: {
  verses: any
  version?: VersionCode
  hasVerseNumbers?: boolean
  hasInlineVerses?: boolean
  hasQuotes?: boolean
  hasAppName?: boolean
  position?: number
}): Promise<VerseRefContent> => {
  // if 1-1_1
  if (typeof verses === 'string') {
    verses = { [verses]: true }
  }

  const selectedVerses = orderVerses(verses)

  let versesContent = ''
  let reference = verseToReference(selectedVerses)
  const bible = await loadBible(version, position)

  selectedVerses.map(async (key, index) => {
    const [book, chapter, verse] = key.split('-')
    const text = bible[book][chapter][verse]
    const inlineVerseContent =
      hasInlineVerses && index !== selectedVerses.length - 1 ? '' : '\n'
    const verseNumberContent = hasVerseNumbers ? `${verse}. ` : ''
    const quoteStartContent = hasQuotes && index === 0 ? '« ' : ''
    const quoteEndContent =
      hasQuotes && index === selectedVerses.length - 1 ? ' »' : ''

    try {
      versesContent += `${quoteStartContent}${verseNumberContent}${text}${quoteEndContent}${inlineVerseContent}`
    } catch {
      versesContent = 'Impossible de charger ce verset.'
    }
  })

  return {
    title: reference || '',
    version,
    content: versesContent,
    all: `${versesContent} \n${reference} ${version} ${
      hasAppName ? '\n\nhttps://bible-strong.app' : ''
    }`,
  }
}
