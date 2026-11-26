import type { IncomingLinkTarget } from '~features/app-switcher/incomingLinks'
import { getBook } from '~helpers/bibleBookCatalog'
import { type BcvLanguage, parseBibleReferenceInput } from '~helpers/bcvParser'

/**
 * The passage text selected in another app names, when it is only a reference (« Jean 3:16 »,
 * « John 3 »): the macOS Service opens it in a tab, in the reader's version. The selection's
 * language is not the app's, so both readings of the reference are tried, the app's first.
 */
export const lookUpPassage = (
  text: string,
  version: string,
  appLanguage: BcvLanguage
): IncomingLinkTarget | undefined => {
  const languages: BcvLanguage[] = appLanguage === 'en' ? ['en', 'fr'] : ['fr', 'en']
  for (const language of languages) {
    const { isExact, segments } = parseBibleReferenceInput(text, language)
    const [segment] = segments
    const book = segment && getBook(segment.book)
    if (!isExact || !segment || !book) continue
    return {
      kind: 'bible',
      route: {
        version,
        presentation: 'text',
        book,
        chapter: segment.chapter,
        ...(segment.isWholeChapter
          ? {}
          : { passage: { startVerse: segment.startVerse, endVerse: segment.endVerse } }),
      },
    }
  }
  return undefined
}
