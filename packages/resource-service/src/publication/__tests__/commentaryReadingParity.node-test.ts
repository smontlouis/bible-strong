import assert from 'node:assert/strict'
import { test } from 'node:test'
import initSqlJs from 'sql.js'
import {
  decodeCanonicalCommentary,
  validateCommentaryOfflineParity,
  type CanonicalCommentaryPublicationV1,
} from '../publicationBundle'

const canonical: CanonicalCommentaryPublicationV1 = {
  format: 'bible-strong-canonical-commentary',
  schemaVersion: 1,
  resourceId: 'barnes',
  language: 'fr',
  revision: 'reading-v1',
  sourceVersion: 'fixture',
  sourceSha256: 'a'.repeat(64),
  readingIndexVersion: 2,
  verses: [{ verseKey: '1-1-1', content: '<p>Commentary.</p>' }],
}

test('validates every projected excerpt, range, identity and body against canonical content', async () => {
  const SQL = await initSqlJs()
  const db = new SQL.Database()
  try {
    db.run(`CREATE TABLE RESOURCE_METADATA(resource_id TEXT, language TEXT, revision TEXT, source_version TEXT, source_sha256 TEXT);
      CREATE TABLE COMMENTAIRES(id TEXT, commentaires TEXT);
      CREATE TABLE COMMENTARY_READING_SECTIONS(id TEXT, book INTEGER, chapter INTEGER, range_start_verse INTEGER, range_end_verse INTEGER, excerpt TEXT, content TEXT);`)
    db.run('INSERT INTO RESOURCE_METADATA VALUES (?, ?, ?, ?, ?)', [
      canonical.resourceId,
      canonical.language,
      canonical.revision,
      canonical.sourceVersion,
      canonical.sourceSha256,
    ])
    db.run('INSERT INTO COMMENTAIRES VALUES (?, ?)', [
      '1-1',
      JSON.stringify({ 1: '<p>Commentary.</p>' }),
    ])
    db.run('INSERT INTO COMMENTARY_READING_SECTIONS VALUES (?, ?, ?, ?, ?, ?, ?)', [
      'barnes-fr-1-1-1-1',
      1,
      1,
      1,
      1,
      'Commentary.',
      '<p>Commentary.</p>',
    ])
    const validArtifact = db.export()
    await validateCommentaryOfflineParity(validArtifact, canonical)
    for (const [column, wrongValue] of [
      ['excerpt', 'Wrong preview'],
      ['range_end_verse', 4],
      ['id', 'different-section'],
    ] as const) {
      const altered = new SQL.Database(validArtifact)
      try {
        altered.run(`UPDATE COMMENTARY_READING_SECTIONS SET ${column}=?`, [wrongValue])
        await assert.rejects(
          validateCommentaryOfflineParity(altered.export(), canonical),
          /READING_INDEX_MISMATCH/
        )
      } finally {
        altered.close()
      }
    }
    db.run("INSERT INTO COMMENTARY_READING_SECTIONS VALUES ('extra', 1, 2, 1, 1, 'Extra', 'Extra')")
    await assert.rejects(
      validateCommentaryOfflineParity(db.export(), canonical),
      /READING_INDEX_MISMATCH/
    )
    db.run('DROP TABLE COMMENTARY_READING_SECTIONS')
    await assert.rejects(
      validateCommentaryOfflineParity(db.export(), canonical),
      /OFFLINE_ARTIFACT_SCHEMA_INVALID/
    )
    const { readingIndexVersion: _, ...legacy } = canonical
    await validateCommentaryOfflineParity(db.export(), legacy)
  } finally {
    db.close()
  }
})

test('rejects an unknown reading index algorithm instead of silently rebuilding another projection', () => {
  assert.throws(
    () => decodeCanonicalCommentary({ ...canonical, readingIndexVersion: 3 }),
    /CANONICAL_COMMENTARY_INVALID/
  )
})
