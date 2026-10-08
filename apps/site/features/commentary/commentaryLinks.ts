import type { ResourceLanguage } from '../resources/publicSite'
import { listCommentaries } from './commentaryCatalog'
import {
  commentaryCovers,
  readCommentaryCoverage,
  type CommentaryChapterRef,
} from './commentaryCoverage'
import { buildCommentaryChapterPath } from './commentaryRoutes'

export type CommentaryLink = {
  /** The Resource identity of the commentary. */
  id: string
  title: string
  path: string
}

/**
 * The commentaries of a language that comment a chapter, for the pages that send their
 * reader to them. A commentary whose coverage cannot be read is left out: these links
 * never keep a page from rendering. The page is told, so it is not kept as if it were whole.
 */
export const listCommentaryLinks = async (
  language: ResourceLanguage,
  ref: CommentaryChapterRef,
  onUnreadable: () => void = () => undefined
): Promise<CommentaryLink[]> => {
  const links = await Promise.all(
    listCommentaries(language).map(async commentary => {
      const coverage = await readCommentaryCoverage(commentary.publicationId, language).catch(
        () => {
          onUnreadable()
          return undefined
        }
      )
      return coverage && commentaryCovers(coverage, ref)
        ? {
            id: commentary.id,
            title: commentary.title,
            path: buildCommentaryChapterPath({ language, resource: commentary.id, ...ref }),
          }
        : undefined
    })
  )
  return links.filter(link => link !== undefined)
}
