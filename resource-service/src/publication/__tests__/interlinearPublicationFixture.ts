import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { zipSync } from 'fflate'
import initSqlJs from 'sql.js'

import {
  deriveInterlinearBibleResourceRevision,
  type CanonicalInterlinearBiblePublication,
  type InterlinearBiblePublicationBundleManifest,
} from '../publicationBundle'

const sha256 = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex')

const baseCanonical = {
  format: 'bible-strong-canonical-interlinear-index' as const,
  schemaVersion: 1 as const,
  applicationVersionId: 'BHG' as const,
  datasetId: 'STEP' as const,
  language: 'fr' as const,
  textRevision: 'bhg-text-v1',
  textSha256: '1'.repeat(64),
  verses: [{ id: 1, book: 1, chapter: 1, verse: 1 }],
  tokens: [{ id: 7, verseId: 1, ordinal: 0, startOffset: 0, length: 8 }],
  segments: [
    {
      id: 11,
      tokenId: 7,
      ordinal: 0,
      startOffset: 0,
      length: 8,
      transliteration: 'bereshit',
      lemma: 'רֵאשִׁית',
      morphology: 'HNcfsa',
      gloss: 'commencement',
    },
  ],
  segmentIdentities: [{ segmentId: 11, identityOrder: 0, kind: 'strong' as const, code: 'H07225' }],
}

export const canonicalInterlinearFixture: CanonicalInterlinearBiblePublication = {
  ...baseCanonical,
  indexRevision: deriveInterlinearBibleResourceRevision(baseCanonical),
}

const makeOfflineSqlite = async (
  canonical: CanonicalInterlinearBiblePublication,
  schemaVersion = 5
) => {
  const SQL = await initSqlJs()
  const database = new SQL.Database()
  database.run(`
    CREATE TABLE ResourceMetadata(key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE Verses(
      id INTEGER PRIMARY KEY, bookOrder INTEGER, bookId TEXT,
      chapter INTEGER, verse INTEGER, ref TEXT
    );
    CREATE TABLE Tokens(
      id INTEGER PRIMARY KEY, verseId INTEGER, readingOrdinal INTEGER,
      startOffset INTEGER, length INTEGER
    );
    CREATE TABLE Transliterations(id INTEGER PRIMARY KEY, value TEXT);
    CREATE TABLE Lemmas(id INTEGER PRIMARY KEY, value TEXT);
    CREATE TABLE Morphologies(id INTEGER PRIMARY KEY, code TEXT);
    CREATE TABLE Glosses(id INTEGER PRIMARY KEY, text TEXT);
    CREATE TABLE StrongCodes(id INTEGER PRIMARY KEY, code TEXT);
    CREATE TABLE Segments(
      id INTEGER PRIMARY KEY, tokenId INTEGER, ordinal INTEGER,
      startOffset INTEGER, length INTEGER, transliterationId INTEGER,
      lemmaId INTEGER, morphologyId INTEGER, glossId INTEGER,
      strongCodeId INTEGER, eStrongCodeId INTEGER,
      dStrongCodeId INTEGER, uStrongCodeId INTEGER
    );
    CREATE TABLE StrongVerseIndex(codeId INTEGER, verseId INTEGER, kindMask INTEGER);
  `)
  for (const [key, value] of Object.entries({
    applicationVersionId: canonical.applicationVersionId,
    datasetId: canonical.datasetId,
    locale: canonical.language,
    textRevision: canonical.textRevision,
    textSha256: canonical.textSha256,
    indexRevision: canonical.indexRevision,
    schemaVersion,
    verseCount: canonical.verses.length,
    tokenCount: canonical.tokens.length,
    segmentCount: canonical.segments.length,
    identityCount: canonical.segmentIdentities.length,
  })) {
    database.run('INSERT INTO ResourceMetadata(key, value) VALUES (?, ?)', [key, String(value)])
  }
  database.run("INSERT INTO Verses VALUES (1, 1, 'Gen', 1, 1, 'Gen.1.1')")
  database.run('INSERT INTO Tokens VALUES (7, 1, 0, 0, 8)')
  database.run("INSERT INTO Transliterations VALUES (1, 'bereshit')")
  database.run("INSERT INTO Lemmas VALUES (1, 'רֵאשִׁית')")
  database.run("INSERT INTO Morphologies VALUES (1, 'HNcfsa')")
  database.run('INSERT INTO Glosses VALUES (1, ?)', [canonical.segments[0]!.gloss])
  database.run("INSERT INTO StrongCodes VALUES (1, 'H07225')")
  database.run('INSERT INTO Segments VALUES (11, 7, 0, 0, 8, 1, 1, 1, 1, 1, NULL, NULL, NULL)')
  database.run('INSERT INTO StrongVerseIndex VALUES (1, 1, 1)')
  const bytes = database.export()
  database.close()
  return bytes
}

export const writeInterlinearPublicationFixture = async (
  root: string,
  options: {
    language?: 'fr' | 'en'
    localDevelopmentAccess?: boolean
    onlineAccess?: boolean
    canonicalLanguage?: 'fr' | 'en'
    extraOfflineEntry?: boolean
    offlineSchemaVersion?: number
  } = {}
) => {
  const language = options.language ?? 'fr'
  const canonicalBase = {
    ...baseCanonical,
    language: options.canonicalLanguage ?? language,
    segments: baseCanonical.segments.map(segment => ({
      ...segment,
      gloss: language === 'fr' ? 'commencement' : 'beginning',
    })),
  }
  const canonical: CanonicalInterlinearBiblePublication = {
    ...canonicalBase,
    indexRevision: deriveInterlinearBibleResourceRevision(canonicalBase),
  }
  const canonicalJson = `${JSON.stringify(canonical)}\n`
  const sqlite = await makeOfflineSqlite(canonical, options.offlineSchemaVersion)
  const entry = `bible-step-interlinear-${language}.sqlite`
  const offline = zipSync({
    [entry]: sqlite,
    ...(options.extraOfflineEntry ? { 'unexpected.txt': new TextEncoder().encode('bad') } : {}),
  })
  const onlineAccess = options.onlineAccess ?? true
  const manifest: InterlinearBiblePublicationBundleManifest = {
    format: 'bible-strong-resource-publication',
    schemaVersion: 1,
    identity: { kind: 'interlinear-index', versionId: 'BHG', datasetId: 'STEP', language },
    revision: canonical.indexRevision,
    canonical: {
      path: `canonical/bible-step-interlinear-${language}.json`,
      mediaType: 'application/json',
      schemaVersion: 1,
      sha256: sha256(canonicalJson),
      bytes: Buffer.byteLength(canonicalJson),
    },
    offlineArtifact: {
      path: `offline/${entry}.zip`,
      mediaType: 'application/zip',
      entry,
      sha256: sha256(offline),
      bytes: offline.byteLength,
      contentSha256: sha256(sqlite),
    },
    provenance: {
      generator: 'bible-lexicon-maker',
      sourceVersion: 'TAHOT/TAGNT',
      sourceSha256: '2'.repeat(64),
      generatedAt: '2026-08-16T00:00:00.000Z',
    },
    rights: {
      holder: 'Tyndale House Cambridge',
      termsReference: 'CC BY 4.0',
      attribution: 'STEPBible.org / Tyndale House Cambridge',
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
        resourceIdentity: 'bible-text:BHG',
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
    counts: { verses: 1, tokens: 1, segments: 1, identities: 1 },
  }

  await mkdir(path.join(root, 'canonical'), { recursive: true })
  await mkdir(path.join(root, 'offline'), { recursive: true })
  await writeFile(path.join(root, manifest.canonical.path), canonicalJson)
  await writeFile(path.join(root, manifest.offlineArtifact.path), offline)
  await writeFile(path.join(root, 'manifest.json'), `${JSON.stringify(manifest)}\n`)
  return { canonical, manifest }
}
