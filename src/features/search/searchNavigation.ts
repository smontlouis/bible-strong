import booksDesc from '~assets/bible_versions/books-desc'

type BibleViewSearchResult = {
  book: number
  chapter: number
  verse: number
  version: string
}

export const getBibleViewParamsForSearchResult = (result: BibleViewSearchResult) => ({
  contextDisplayMode: 'focused',
  book: JSON.stringify(booksDesc[result.book - 1]),
  chapter: String(result.chapter),
  verse: String(result.verse),
  version: result.version,
  focusVerses: JSON.stringify([result.verse]),
})
