import { getBook } from '~helpers/bibleBookCatalog'
import generateUUID from '~helpers/generateUUID'
import type { SearchEntityResult } from '~features/search/shared/searchResultTypes'
import { getDefaultBibleTab, type TabItem, type VersionCode } from '~state/tabs'

export function getTabForSearchResult(
  item: SearchEntityResult,
  defaultVersion: VersionCode
): TabItem | undefined {
  const base = { id: generateUUID(), title: item.title, isRemovable: true }
  if (item.passage) {
    const passage = item.passage
    const book = getBook(passage.book)
    if (!book) return undefined
    const tab = getDefaultBibleTab((passage.version as VersionCode) || defaultVersion)
    const selection = {
      selectedBook: book,
      selectedChapter: passage.chapter,
      selectedVerse: passage.verse,
    }
    const endVerse =
      passage.endChapter === passage.chapter ? (passage.endVerse ?? passage.verse) : passage.verse
    return {
      ...tab,
      ...base,
      data: {
        ...tab.data,
        ...selection,
        temp: selection,
        contextDisplayMode: 'focused',
        focusVerses: Array.from(
          { length: Math.max(1, endVerse - passage.verse + 1) },
          (_, index) => passage.verse + index
        ),
      },
    }
  }
  const endpoint = item.endpoint
  if (!endpoint) return undefined
  switch (endpoint.type) {
    case 'note':
      return { ...base, type: 'notes', data: { noteId: endpoint.noteId } }
    case 'study':
      return { ...base, type: 'study', data: { studyId: endpoint.studyId } }
    case 'strong':
      return {
        ...base,
        type: 'strong',
        data: { book: endpoint.language === 'hebrew' ? 1 : 40, reference: endpoint.code },
      }
    case 'dictionary':
      return { ...base, type: 'dictionary', data: { word: endpoint.word } }
    case 'nave':
      return {
        ...base,
        type: 'nave',
        data: { name_lower: endpoint.nameLower, name: endpoint.labelFallback },
      }
    default:
      return undefined
  }
}
