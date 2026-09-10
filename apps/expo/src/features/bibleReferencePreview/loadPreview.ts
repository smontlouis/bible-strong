import type { BibleContentAccess } from '~features/resources/bibleContentAccess'
import type { ReferencePreviewTarget } from './referenceTarget'

export async function loadReferencePreview(
  target: ReferencePreviewTarget,
  version: string,
  access: BibleContentAccess
) {
  const chapters = [...new Map(target.selections.map(s => [`${s.book}-${s.chapter}`, s])).values()]
  const results = await Promise.all(
    chapters.map(async ({ book, chapter }) => {
      const result = await access.loadChapter({ book, chapter, version })
      if (!result.success) throw new Error(result.error.message)
      return { book, chapter, verses: result.data.verses }
    })
  )
  return results.flatMap(({ book, chapter, verses }) =>
    verses.filter(verse =>
      target.selections.some(
        s =>
          s.book === book &&
          s.chapter === chapter &&
          (s.start === undefined || Number(verse.Verset) >= s.start) &&
          (s.end === undefined || Number(verse.Verset) <= s.end)
      )
    )
  )
}
