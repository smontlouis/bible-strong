import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { zipSync } from 'fflate'
import initSqlJs from 'sql.js'

import {
  deriveStrongBibleResourceRevision,
  type CanonicalStrongBiblePublication,
  type StrongBiblePublicationBundleManifest,
} from '../publicationBundle'

const sha256 = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex')

export const canonicalStrongFixture: CanonicalStrongBiblePublication = {
  format: 'bible-strong-canonical-strong-index',
  schemaVersion: 1,
  applicationVersionId: 'LSG',
  datasetId: 'LSG',
  textRevision: 'lsg-text-v1',
  textSha256: '1'.repeat(64),
  strongRevision: '2'.repeat(64),
  verses: [{ book: 1, chapter: 1, verse: 1 }],
  lexemes: [{ id: 1, lemma: 'Dieu', partOfSpeech: 'N' }],
  identities: [{ id: 1, kind: 'strong', code: 'H0430' }],
  spans: [
    {
      book: 1,
      chapter: 1,
      verse: 1,
      ordinal: 0,
      startOffset: 0,
      length: 4,
      isAligned: true,
      lexemeId: 1,
      stepTokenIds: [7, 8],
    },
  ],
  spanIdentities: [
    {
      book: 1,
      chapter: 1,
      verse: 1,
      ordinal: 0,
      identityOrder: 0,
      identityId: 1,
    },
  ],
}

const makeOfflineSqlite = async (canonical: CanonicalStrongBiblePublication) => {
  const SQL = await initSqlJs()
  const database = new SQL.Database()
  database.run(`
    CREATE TABLE ResourceMetadata(key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE Verses(id INTEGER PRIMARY KEY, bookOrder INTEGER, chapter INTEGER, verse INTEGER);
    CREATE TABLE FrenchLexemes(id INTEGER PRIMARY KEY, lemma TEXT, partOfSpeech TEXT);
    CREATE TABLE WordSpans(
      verseId INTEGER, ordinal INTEGER, startOffset INTEGER, length INTEGER,
      isAligned INTEGER, openOrder INTEGER, closeOrder INTEGER, lexemeId INTEGER,
      stepTokenId INTEGER, PRIMARY KEY(verseId, ordinal)
    );
    CREATE TABLE StrongCodes(id INTEGER PRIMARY KEY, kind INTEGER, code TEXT);
    CREATE TABLE WordStrongCodes(
      verseId INTEGER, ordinal INTEGER, identityOrder INTEGER, codeId INTEGER,
      PRIMARY KEY(verseId, ordinal, identityOrder)
    );
    CREATE TABLE WordStepTokenExtras(
      verseId INTEGER, targetOrdinal INTEGER, sourceOrder INTEGER, stepTokenId INTEGER,
      PRIMARY KEY(verseId, targetOrdinal, sourceOrder)
    );
  `)
  for (const [key, value] of Object.entries({
    applicationVersionId: canonical.applicationVersionId,
    datasetId: canonical.datasetId,
    textRevision: canonical.textRevision,
    textSha256: canonical.textSha256,
    strongRevision: canonical.strongRevision,
    schemaVersion: 3,
    verseCount: canonical.verses.length,
    occurrenceCount: canonical.spans.length,
    unalignedOccurrenceCount: canonical.spans.filter(span => !span.isAligned).length,
    identityCount: canonical.spanIdentities.length,
    lexemeAssignmentCount: canonical.spans.filter(span => span.lexemeId !== undefined).length,
    lexemeCount: canonical.lexemes.length,
  })) {
    database.run('INSERT INTO ResourceMetadata(key, value) VALUES (?, ?)', [key, String(value)])
  }
  const firstVerse = canonical.verses[0]!
  database.run('INSERT INTO Verses VALUES (1, ?, ?, ?)', [
    firstVerse.book,
    firstVerse.chapter,
    firstVerse.verse,
  ])
  database.run("INSERT INTO FrenchLexemes VALUES (1, 'Dieu', 'N')")
  database.run('INSERT INTO WordSpans VALUES (1, 0, 0, 4, 1, 0, 1, 1, 7)')
  database.run("INSERT INTO StrongCodes VALUES (1, 0, 'H0430')")
  database.run('INSERT INTO WordStrongCodes VALUES (1, 0, 0, 1)')
  database.run('INSERT INTO WordStepTokenExtras VALUES (1, 0, 0, 8)')
  const bytes = database.export()
  database.close()
  return bytes
}

export const writeStrongPublicationFixture = async (
  root: string,
  options: {
    localDevelopmentAccess?: boolean
    onlineAccess?: boolean
    strongRevision?: string
    textRevision?: string
    textSha256?: string
    duplicateIdentityCode?: boolean
    extraOfflineEntry?: boolean
    zeroVerse?: boolean
  } = {}
) => {
  const canonical: CanonicalStrongBiblePublication = {
    ...canonicalStrongFixture,
    strongRevision: options.strongRevision ?? canonicalStrongFixture.strongRevision,
    textRevision: options.textRevision ?? canonicalStrongFixture.textRevision,
    textSha256: options.textSha256 ?? canonicalStrongFixture.textSha256,
    identities: options.duplicateIdentityCode
      ? [
          ...canonicalStrongFixture.identities,
          { id: 2, kind: 'strong', code: canonicalStrongFixture.identities[0]!.code },
        ]
      : canonicalStrongFixture.identities,
    ...(options.zeroVerse
      ? {
          verses: canonicalStrongFixture.verses.map(verse => ({ ...verse, verse: 0 })),
          spans: canonicalStrongFixture.spans.map(span => ({ ...span, verse: 0 })),
          spanIdentities: canonicalStrongFixture.spanIdentities.map(identity => ({
            ...identity,
            verse: 0,
          })),
        }
      : {}),
  }
  const canonicalJson = `${JSON.stringify(canonical)}\n`
  const sqlite = await makeOfflineSqlite(canonical)
  const offline = zipSync({
    'bible-lsg-strong.sqlite': sqlite,
    ...(options.extraOfflineEntry ? { 'unexpected.txt': new TextEncoder().encode('bad') } : {}),
  })
  const onlineAccess = options.onlineAccess ?? true
  const manifest: StrongBiblePublicationBundleManifest = {
    format: 'bible-strong-resource-publication',
    schemaVersion: 1,
    identity: {
      kind: 'strong-bible-index',
      versionId: canonical.applicationVersionId,
      datasetId: canonical.datasetId,
      language: 'fr',
    },
    revision: deriveStrongBibleResourceRevision(canonical),
    canonical: {
      path: 'canonical/bible-lsg-strong.json',
      mediaType: 'application/json',
      schemaVersion: 1,
      sha256: sha256(canonicalJson),
      bytes: Buffer.byteLength(canonicalJson),
    },
    offlineArtifact: {
      path: 'offline/bible-lsg-strong.sqlite.zip',
      mediaType: 'application/zip',
      entry: 'bible-lsg-strong.sqlite',
      sha256: sha256(offline),
      bytes: offline.byteLength,
      contentSha256: sha256(sqlite),
    },
    provenance: {
      generator: 'bible-lexicon-maker',
      sourceVersion: 'SG1910',
      sourceSha256: '3'.repeat(64),
      generatedAt: '2026-08-16T00:00:00.000Z',
    },
    rights: {
      holder: 'Public domain',
      termsReference: 'Segond 1910',
      attribution: 'Louis Segond',
      online: onlineAccess,
      offline: true,
    },
    deliveryCapabilities: {
      onlineAccess,
      offlineDownload: true,
      localDevelopmentAccess: options.localDevelopmentAccess,
    },
    dependencies: {
      bible: {
        resourceIdentity: 'bible-text:LSG',
        revision: canonical.textRevision,
        textSha256: canonical.textSha256,
        online: 'required',
        offline: 'required',
      },
      strongLexiconModules: [
        {
          resourceIdentity: 'strong-lexicon:core',
          online: 'required-for-lexical-details',
          offline: 'required-for-lexical-details',
        },
      ],
    },
    counts: {
      verses: 1,
      occurrences: 1,
      unalignedOccurrences: 0,
      identities: 1,
      lexemeAssignments: 1,
      lexemes: 1,
    },
  }

  await mkdir(path.join(root, 'canonical'), { recursive: true })
  await mkdir(path.join(root, 'offline'), { recursive: true })
  await writeFile(path.join(root, manifest.canonical.path), canonicalJson)
  await writeFile(path.join(root, manifest.offlineArtifact.path), offline)
  await writeFile(path.join(root, 'manifest.json'), `${JSON.stringify(manifest)}\n`)
  return { canonical, manifest }
}
