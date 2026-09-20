import generateUUID from '~helpers/generateUUID'
import { getBook } from '~helpers/bibleBookCatalog'
import { versions } from '~helpers/bibleVersions'
import verseToReference from '~helpers/verseToReference'
import { getDefaultBibleTab, type TabItem, type VersionCode } from '~state/tabs'

export type PassageTabOpenRequest = {
  tabType: 'bible' | 'compare'
  book: number
  chapter: number
  startVerse: number
  endVerse: number
  version: string
  isWholeChapter?: boolean
  title?: string
}

export function createPassageTab(request: PassageTabOpenRequest): TabItem | undefined {
  const book = getBook(request.book)
  if (
    !book ||
    !Object.hasOwn(versions, request.version) ||
    !Number.isInteger(request.chapter) ||
    request.chapter < 1 ||
    request.chapter > book.Chapitres ||
    !Number.isInteger(request.startVerse) ||
    request.startVerse < 1 ||
    request.startVerse > 176 ||
    !Number.isInteger(request.endVerse) ||
    request.endVerse < request.startVerse ||
    request.endVerse > 176
  )
    return undefined

  const verses = Array.from(
    { length: request.endVerse - request.startVerse + 1 },
    (_, index) => request.startVerse + index
  )
  const keys = verses.map(verse => `${request.book}-${request.chapter}-${verse}`)
  const title =
    request.title ||
    verseToReference({
      bookNum: request.book,
      chapterNum: request.chapter,
      ...(request.isWholeChapter ? {} : { verses }),
    })

  if (request.tabType === 'compare')
    return {
      id: generateUUID(),
      title,
      isRemovable: true,
      type: 'compare',
      data: { selectedVerses: Object.fromEntries(keys.map(key => [key, true])) },
    }

  const tab = getDefaultBibleTab(request.version as VersionCode)
  const selection = {
    selectedBook: book,
    selectedChapter: request.chapter,
    selectedVerse: request.startVerse,
  }
  return {
    ...tab,
    title,
    data: {
      ...tab.data,
      ...selection,
      temp: selection,
      focusVerses: request.isWholeChapter ? undefined : verses,
      contextDisplayMode: request.isWholeChapter ? 'fullChapter' : 'focused',
    },
  }
}
