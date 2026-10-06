import type { CommentaryChapterResponseDto } from '@bible-strong/resource-domain/contracts/supplementaryContract'
import type { ResourceLanguage } from '../resources/publicSite'
import { readResource } from '../resources/resourceApi'
import type { Commentary } from './commentaryCatalog'
import type { CommentaryChapterRef } from './commentaryCoverage'
import {
  buildCommentarySections,
  decodeCommentaryChapter,
  type CommentarySection,
} from './commentarySections'

/**
 * The sections of a commentary on one chapter, in reading order: what its chapter page reads
 * and what a Bible page shows in its text. A chapter it says nothing on has none.
 */
export const readCommentarySections = async (
  commentary: Commentary,
  language: ResourceLanguage,
  { book, chapter }: CommentaryChapterRef
): Promise<CommentarySection[]> => {
  const response = await readResource<CommentaryChapterResponseDto>(
    `/v1/commentaries/${encodeURIComponent(commentary.publicationId)}/${language}/chapters/${book}/${chapter}`
  )
  return response
    ? buildCommentarySections(commentary.id, decodeCommentaryChapter(response.serializedComments))
    : []
}
