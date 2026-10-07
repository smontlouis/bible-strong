import type { ResourceLanguage } from '../resources/publicSite'
import type { Breadcrumb } from '../resources/resourceHead'
import { resourceSection } from '../resources/sections'
import { bibleBookName } from './bibleBooks'
import { withInlineCommentaries } from './bibleCommentaries'
import {
  buildBiblePath,
  buildBibleVersionPath,
  type BiblePassage,
  type BiblePresentation,
} from './bibleRoutes'

/** Bible › version. */
export const bibleVersionBreadcrumbs = (
  versionId: string,
  language: ResourceLanguage
): Breadcrumb[] => {
  const section = resourceSection('bible')
  return [
    { label: section.label[language], path: section.path(language) },
    { label: versionId, path: buildBibleVersionPath(versionId) },
  ]
}

/** Bible › version › chapter, then the passage when one is quoted. */
export const bibleBreadcrumbs = (
  {
    versionId,
    presentation,
    language,
    book,
    chapter,
    passage,
    gloss,
  }: {
    versionId: string
    presentation: BiblePresentation
    language: ResourceLanguage
    book: number
    chapter: number
    passage?: BiblePassage
    gloss?: ResourceLanguage
  },
  /** The commentaries shown in the text, which the path of a reading keeps for its reader. */
  commentaryChoice: readonly string[] = []
): Breadcrumb[] => {
  const location = { versionId, presentation, book, chapter, gloss }
  const reference = `${bibleBookName(book, language)} ${chapter}`
  const keep = (path: string) => withInlineCommentaries(path, commentaryChoice)
  return [
    ...bibleVersionBreadcrumbs(versionId, language),
    { label: reference, path: keep(buildBiblePath(location)) },
    ...(passage
      ? [
          {
            label: `${reference}:${passage.startVerse}${passage.endVerse ? `-${passage.endVerse}` : ''}`,
            path: keep(buildBiblePath({ ...location, passage })),
          },
        ]
      : []),
  ]
}
