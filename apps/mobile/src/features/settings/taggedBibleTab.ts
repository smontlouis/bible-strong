import { getBook } from '~helpers/bibleBookCatalog'
import { getBibleReferenceLocation } from '~helpers/bibleReferenceLocation'
import type { VersionCode } from '~state/tabs'

type TaggedBibleTabDataOptions = {
  verseKeys: string[]
  preferredVersion?: string
  defaultVersion: string
}

export const getTaggedBibleTabData = ({
  verseKeys,
  preferredVersion,
  defaultVersion,
}: TaggedBibleTabDataOptions) => {
  const { bookNumber, chapter, verse, focusVerses } = getBibleReferenceLocation(verseKeys)

  return {
    selectedBook: getBook(bookNumber) || getBook(1)!,
    selectedChapter: chapter,
    selectedVerse: verse,
    selectedVersion: (preferredVersion || defaultVersion) as VersionCode,
    focusVerses,
    contextDisplayMode: 'focused' as const,
    entityReference: {
      verseKeys,
      ...(preferredVersion && { preferredVersion }),
    },
  }
}

export const getTaggedWordAnnotationVerseKeys = ({
  verseKey,
  verseKeys,
}: {
  verseKey: string
  verseKeys?: string[]
}): string[] => (verseKeys?.length ? verseKeys : [verseKey])
