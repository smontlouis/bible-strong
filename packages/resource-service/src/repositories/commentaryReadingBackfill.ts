import { sql, type Kysely } from 'kysely'
import {
  buildCommentaryReadingSections,
  createCommentaryReadingIndex,
} from '@bible-strong/resource-domain/contracts/commentarySections'
import type { ResourceDatabase } from '../database/types'

/** Rebuild a derived projection, never the immutable source or publication metadata. */
export async function backfillCommentaryReadingIndex(
  database: Kysely<ResourceDatabase>,
  input: { resourceId: string; language: 'fr' | 'en'; apply: boolean }
) {
  return database.transaction().execute(async transaction => {
    const publication = await transaction
      .selectFrom('resource_publications')
      .select(['id', 'revision'])
      .where('resource_identity', '=', `commentary:${input.resourceId}:${input.language}`)
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
    if (input.apply)
      await transaction
        .deleteFrom('commentary_reading_sections')
        .where('publication_id', '=', publication.id)
        .execute()
    let sectionCount = 0
    let indexBytes = 0
    for (const { chapter: key } of chapters) {
      const [book, chapter] = key.split('-').map(Number)
      const rows = await transaction
        .selectFrom('commentary_verses')
        .select(['verse_key', 'content'])
        .where('publication_id', '=', publication.id)
        .where('verse_key', 'like', `${key}-%`)
        .execute()
      const sections = buildCommentaryReadingSections({
        entry: { id: input.resourceId, publicationId: input.resourceId },
        language: input.language,
        book: book!,
        chapter: chapter!,
        comments: Object.fromEntries(rows.map(row => [row.verse_key.split('-')[2]!, row.content])),
      })
      const index = createCommentaryReadingIndex(sections)
      sectionCount += sections.length
      indexBytes += Buffer.byteLength(JSON.stringify(index))
      if (input.apply) {
        const values = sections.map((section, ordinal) => ({
          publication_id: publication.id,
          id: section.id,
          book: book!,
          chapter: chapter!,
          range_start_verse: section.rangeStartVerse,
          range_end_verse: section.rangeEndVerse,
          excerpt: index[ordinal]!.excerpt,
          content: section.content,
        }))
        for (let offset = 0; offset < values.length; offset += 100) {
          await transaction
            .insertInto('commentary_reading_sections')
            .values(values.slice(offset, offset + 100))
            .execute()
        }
      }
    }
    return {
      resourceId: input.resourceId,
      language: input.language,
      revision: publication.revision,
      chapters: chapters.length,
      sections: sectionCount,
      indexBytes,
      applied: input.apply,
    }
  })
}
