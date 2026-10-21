import {
  buildCommentaryChapterSections,
  type CommentaryChapterComments,
} from '@bible-strong/resource-domain/commentary-chapter-sections'
import { sql, type Kysely } from 'kysely'

import type { ResourceDatabase } from '../database/types'

// The longest chapter of a Bible has 176 verses; verse 0 is the introduction of a chapter.
export const COMMENTARY_CHAPTER_LAST_VERSE = 200

// A verse written in its canonical form, from the introduction to the last verse a chapter
// may have. Some commentaries file notes under higher numbers, which no verse page reads.
const isChapterVerse = (verse: string) =>
  /^(?:0|[1-9]\d*)$/.test(verse) && Number(verse) <= COMMENTARY_CHAPTER_LAST_VERSE

/**
 * The rows of `commentary_chapter_sections` for one chapter of a commentary publication:
 * its sections as the public site builds them (ADR-0073), in their order, from the comments
 * filed under verses 0 to 200. The collection is the middle of the publication identity,
 * `commentary:<collection>:<language>`, which the sections of the anthology read by source
 * document depend on.
 */
export const commentaryChapterSectionRows = (input: {
  publicationId: number
  resourceIdentity: string
  book: number
  chapter: number
  comments: CommentaryChapterComments
}) =>
  buildCommentaryChapterSections(
    input.resourceIdentity.split(':')[1] ?? '',
    Object.fromEntries(Object.entries(input.comments).filter(([verse]) => isChapterVerse(verse)))
  ).map((section, ordinal) => ({
    publication_id: input.publicationId,
    book: input.book,
    chapter: input.chapter,
    ordinal,
    slug: section.slug,
    start_verse: section.startVerse,
    end_verse: section.endVerse,
    content: section.content,
  }))

/**
 * Writes the chapter sections of an active commentary publication from its comments, for the
 * publications imported before the sections were written at publication. The comments and
 * the publication are left as they are; the sections already written are replaced.
 */
export async function backfillCommentaryChapterSections(
  database: Kysely<ResourceDatabase>,
  input: { resourceIdentity: string; apply: boolean }
) {
  return database.transaction().execute(async transaction => {
    const publication = await transaction
      .selectFrom('resource_publications')
      .select(['id', 'revision'])
      .where('resource_identity', '=', input.resourceIdentity)
      .where('resource_kind', '=', 'commentary')
      .where('status', '=', 'active')
      .forUpdate()
      .executeTakeFirst()
    if (!publication) throw new Error('COMMENTARY_ACTIVE_PUBLICATION_REQUIRED')
    const chapters = await transaction
      .selectFrom('commentary_verses')
      .select(
        sql<string>`concat(split_part(verse_key, '-', 1), '-', split_part(verse_key, '-', 2))`.as(
          'chapter'
        )
      )
      .where('publication_id', '=', publication.id)
      .distinct()
      .execute()
    if (!chapters.length) throw new Error('COMMENTARY_SOURCE_CONTENT_REQUIRED')
    if (input.apply) {
      await transaction
        .deleteFrom('commentary_chapter_sections')
        .where('publication_id', '=', publication.id)
        .execute()
    }
    let sections = 0
    for (const { chapter: key } of chapters) {
      const [book, chapter] = key.split('-').map(Number)
      const comments = await transaction
        .selectFrom('commentary_verses')
        .select(['verse_key', 'content'])
        .where('publication_id', '=', publication.id)
        .where('verse_key', 'like', `${key}-%`)
        .execute()
      const rows = commentaryChapterSectionRows({
        publicationId: publication.id,
        resourceIdentity: input.resourceIdentity,
        book: book!,
        chapter: chapter!,
        comments: Object.fromEntries(
          comments.map(row => [row.verse_key.split('-')[2]!, row.content])
        ),
      })
      sections += rows.length
      if (input.apply) {
        for (let offset = 0; offset < rows.length; offset += 500) {
          await transaction
            .insertInto('commentary_chapter_sections')
            .values(rows.slice(offset, offset + 500))
            .execute()
        }
      }
    }
    return {
      resourceIdentity: input.resourceIdentity,
      revision: publication.revision,
      chapters: chapters.length,
      sections,
      applied: input.apply,
    }
  })
}
