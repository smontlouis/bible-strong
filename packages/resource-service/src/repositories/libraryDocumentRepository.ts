// Reads a document of a library collection (ADR-0106): its passages, in order, joined back into
// its text. The Worker loads this module with the library search, without the import code.
import { sql, type Kysely } from 'kysely'

import type { ResourceDatabase } from '../database/types'
import { collectionIdentity } from '../search/libraryCollections'
import type { LibraryLanguage } from '../search/libraryDocuments'

export type LibraryDocumentInput = {
  collection: string
  language: LibraryLanguage
  documentKey: string
}

/** Longer documents are cut: the reader keeps the beginning, and is told so. */
export const LIBRARY_DOCUMENT_MAX_CHARACTERS = 12_000

export type LibraryDocumentResult = {
  collection: string
  collectionTitle: string
  tradition: string | null
  tags: string[]
  language: LibraryLanguage
  documentKey: string
  title: string
  heading: string
  url: string | null
  text: string
  truncated: boolean
  totalCharacters: number
} | null

/** The whole text of a document of an active collection, its passages joined in order. */
export async function readLibraryDocument(
  database: Kysely<ResourceDatabase>,
  input: LibraryDocumentInput
): Promise<LibraryDocumentResult> {
  const identity = collectionIdentity(input.collection, input.language)
  // Keys of a document are « <documentKey>#<part> ».
  const { rows } = await sql<{
    work: string
    work_title: string
    tradition: string | null
    tags: string[]
    title: string
    heading: string
    part: number
    content: string
    target: { url?: string }
  }>`
    select p.work, p.work_title, p.tradition, p.tags, p.title, p.heading, p.part, p.content, p.target
    from library_passages p
    join resource_publications r on r.id = p.publication_id
    where r.resource_identity = ${identity} and r.status = 'active'
      and starts_with(p.passage_key, ${`${input.documentKey}#`})
    order by p.part`.execute(database)
  if (!rows.length) return null
  const full = rows.map(row => row.content).join('\n\n')
  const first = rows[0]
  return {
    collection: first.work,
    collectionTitle: first.work_title,
    tradition: first.tradition,
    tags: first.tags,
    language: input.language,
    documentKey: input.documentKey,
    title: first.title,
    heading: first.heading,
    url: typeof first.target.url === 'string' ? first.target.url : null,
    text: full.slice(0, LIBRARY_DOCUMENT_MAX_CHARACTERS),
    truncated: full.length > LIBRARY_DOCUMENT_MAX_CHARACTERS,
    totalCharacters: full.length,
  }
}
