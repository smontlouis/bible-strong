import { bibleBookName } from '../bible/bibleBooks'
import type { ResourceLanguage } from '../resources/publicSite'
import type { Breadcrumb } from '../resources/resourceHead'
import { resourceSection } from '../resources/sections'
import {
  buildCommentaryChapterPath,
  buildCommentaryIndexPath,
  buildCommentaryPath,
} from './commentaryRoutes'

type CommentaryRef = { id: string; title: string }

/** Commentaries › the commentary. */
export const commentaryBreadcrumbs = (
  language: ResourceLanguage,
  commentary: CommentaryRef
): Breadcrumb[] => [
  {
    label: resourceSection('commentary').label[language],
    path: buildCommentaryIndexPath(language),
  },
  { label: commentary.title, path: buildCommentaryPath(language, commentary.id) },
]

/** Commentaries › the commentary › the chapter, with its page beyond the first. */
export const commentaryChapterBreadcrumbs = ({
  language,
  commentary,
  book,
  chapter,
  page,
}: {
  language: ResourceLanguage
  commentary: CommentaryRef
  book: number
  chapter: number
  page: number
}): Breadcrumb[] => [
  ...commentaryBreadcrumbs(language, commentary),
  {
    label: `${bibleBookName(book, language)} ${chapter}${page > 1 ? ` – page ${page}` : ''}`,
    path: buildCommentaryChapterPath({ language, resource: commentary.id, book, chapter }, page),
  },
]
