import initSqlJs from 'sql.js'

import type { CanonicalNavePublication } from '../publicationBundle'

export const makeNaveSqliteFixture = async (publication: CanonicalNavePublication) => {
  const SQL = await initSqlJs()
  const database = new SQL.Database()
  try {
    database.run(`
      CREATE TABLE RESOURCE_METADATA (
        resource_id TEXT NOT NULL,
        revision TEXT NOT NULL,
        source_version TEXT NOT NULL,
        source_sha256 TEXT NOT NULL
      );
      CREATE TABLE TOPICS (
        name_lower TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        letter TEXT NOT NULL,
        description TEXT NOT NULL
      );
      CREATE TABLE VERSES (
        id TEXT PRIMARY KEY,
        ref TEXT NOT NULL
      );
    `)
    database.run('INSERT INTO RESOURCE_METADATA VALUES (?, ?, ?, ?)', [
      publication.resourceId,
      publication.revision,
      publication.sourceVersion,
      publication.sourceSha256,
    ])
    for (const topic of publication.topics) {
      database.run('INSERT INTO TOPICS VALUES (?, ?, ?, ?)', [
        topic.normalizedName,
        topic.name,
        topic.initial,
        topic.description,
      ])
    }
    for (const anchor of publication.verseAnchors) {
      database.run('INSERT INTO VERSES VALUES (?, ?)', [
        anchor.verseKey,
        JSON.stringify(anchor.topicNormalizedNames),
      ])
    }
    return database.export()
  } finally {
    database.close()
  }
}
