import * as Schema from 'effect/Schema'
import {
  buildCommentaryReadingSections,
  buildNormalizedCommentaryReadingSections,
} from '@bible-strong/resource-domain/contracts/commentarySections'
import {
  CommentaryReadingResourceIndex,
  CommentaryReadingSectionResponse,
} from '@bible-strong/resource-domain/contracts/commentaryReadingContract'
import { getCommentaryDbPath } from '~helpers/databases'
import { openSQLiteDatabase } from '~helpers/sqlite'
import { getLocalResourceAvailability } from './resourceAvailability'
import { localCommentaryChapterSource } from './commentaryAccess'
import type { CommentaryReadingLocal } from './commentaryReadingAccess'

async function openInstalled(resourceId: string, language: 'fr' | 'en') {
  const available = await getLocalResourceAvailability({ kind: 'commentary', resourceId, language })
  if (available.status !== 'available') return undefined
  const path = getCommentaryDbPath(resourceId, language)
  const file = path.split('/').pop()!
  const database = await openSQLiteDatabase(
    file,
    { useNewConnection: true },
    path.slice(0, -(file.length + 1))
  )
  try {
    const metadata = await database.getFirstAsync<{ revision: string }>(
      'SELECT revision FROM RESOURCE_METADATA LIMIT 1'
    )
    if (metadata?.revision) return { database, revision: metadata.revision }
  } catch (error) {
    await database.closeAsync()
    throw error
  }
  await database.closeAsync()
  return undefined
}

async function loadReadingSections(
  resourceId: string,
  language: 'fr' | 'en',
  book: number,
  chapter: number,
  revision: string
) {
  const installed = await openInstalled(resourceId, language)
  if (!installed) return undefined
  const { database } = installed
  try {
    if (installed.revision !== revision) return undefined
    const normalized = await database.getFirstAsync(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='COMMENTARY_DOCUMENTS'"
    )
    if (normalized) {
      const prefix = `${book}-${chapter}-`
      const end = `${prefix}\uffff`
      const documents = await database.getAllAsync<{ id: string; content: string }>(
        'SELECT id, content FROM COMMENTARY_DOCUMENTS WHERE id IN (SELECT document_id FROM COMMENTARY_VERSE_DOCUMENTS WHERE verse_key >= ? AND verse_key < ?)',
        prefix,
        end
      )
      const associations = await database.getAllAsync<{
        verse_key: string
        document_id: string
        ordinal: number
      }>(
        'SELECT verse_key, document_id, ordinal FROM COMMENTARY_VERSE_DOCUMENTS WHERE verse_key >= ? AND verse_key < ? ORDER BY verse_key, ordinal',
        prefix,
        end
      )
      return buildNormalizedCommentaryReadingSections({
        entry: { id: resourceId, publicationId: resourceId },
        language,
        book,
        chapter,
        documents,
        associations: associations.map(row => ({
          verse: Number(row.verse_key.slice(prefix.length)),
          documentId: row.document_id,
          ordinal: row.ordinal,
        })),
      })
    }
  } finally {
    await database.closeAsync()
  }
  const comments = await localCommentaryChapterSource.loadResourceChapter(
    resourceId,
    language,
    book,
    chapter
  )
  return buildCommentaryReadingSections({
    entry: { id: resourceId, publicationId: resourceId },
    language,
    book,
    chapter,
    comments,
  })
}

export const localCommentaryReading: CommentaryReadingLocal = {
  async index(resourceId, language, book, chapter) {
    const installed = await openInstalled(resourceId, language)
    if (!installed) return undefined
    const { database, revision } = installed
    const resource = { kind: 'commentary' as const, resourceId, language, revision }
    try {
      const table = await database.getFirstAsync(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='COMMENTARY_READING_SECTIONS'"
      )
      if (table) {
        const rows = await database.getAllAsync<{
          id: string
          range_start_verse: number
          range_end_verse: number
          excerpt: string
        }>(
          'SELECT id, range_start_verse, range_end_verse, excerpt FROM COMMENTARY_READING_SECTIONS WHERE book=? AND chapter=? ORDER BY range_start_verse, range_end_verse, id',
          book,
          chapter
        )
        return Schema.decodeUnknownSync(CommentaryReadingResourceIndex)({
          resource,
          sections: rows.map(row => ({
            id: row.id,
            rangeStartVerse: row.range_start_verse,
            rangeEndVerse: row.range_end_verse,
            excerpt: row.excerpt,
          })),
        })
      }
    } finally {
      await database.closeAsync()
    }
    // Older copies need the published update; chapter reading never builds an index.
    return undefined
  },
  async section(request) {
    // The full text already exists in the source tables; do not duplicate an
    // entire commentary in the offline index. Reconstruct only on explicit open.
    const sections = await loadReadingSections(
      request.resourceId,
      request.language,
      request.book,
      request.chapter,
      request.revision
    )
    const content = sections?.find(section => section.id === request.sectionId)
    const current = await openInstalled(request.resourceId, request.language)
    if (!current) return undefined
    await current.database.closeAsync()
    if (current.revision !== request.revision || !content) return undefined
    return Schema.decodeUnknownSync(CommentaryReadingSectionResponse)({
      resource: {
        kind: 'commentary',
        resourceId: request.resourceId,
        language: request.language,
        revision: request.revision,
      },
      book: request.book,
      chapter: request.chapter,
      section: content,
    })
  },
}
