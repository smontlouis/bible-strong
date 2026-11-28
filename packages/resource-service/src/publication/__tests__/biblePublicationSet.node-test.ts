import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  assertCandidateCatalogChangesOnly,
  catalogResourceCount,
  firstCanonicalChapter,
  isBibleFamilyCatalogId,
  resolveBiblePublicationOverlay,
  selectBibleFamilyBaseline,
  type BiblePublicationSetEntry,
  type RawPublicationCatalog,
} from '../biblePublicationSet'

const bible = (revision: string, textSha256: string): BiblePublicationSetEntry => ({
  bundlePath: `/baseline/bible-${revision}`,
  catalogId: 'bible:LSG',
  resourceIdentity: 'bible-text:LSG',
  revision,
  bibleTextSha256: textSha256,
})

const strong = (revision: string, textRevision: string): BiblePublicationSetEntry => ({
  bundlePath: `/baseline/strong-${revision}`,
  catalogId: 'bible-strong:LSG',
  resourceIdentity: 'strong-bible-index:LSG',
  revision,
  bibleDependency: {
    resourceIdentity: 'bible-text:LSG',
    revision: textRevision,
    textSha256: `${textRevision}-sha`,
  },
})

describe('Bible publication set', () => {
  it('rejects a changed Bible while its Strong sidecar still targets the old text', () => {
    assert.throws(
      () =>
        resolveBiblePublicationOverlay(
          [bible('old', 'old-sha'), strong('strong-old', 'old')],
          [bible('new', 'new-sha')],
          'LSG',
          2
        ),
      /BIBLE_PUBLICATION_DEPENDENT_REBUILD_REQUIRED:bible-strong:LSG/
    )
  })

  it('replaces the Bible and its rebuilt dependent while retaining the exhaustive baseline', () => {
    const candidateBible = bible('new', 'new-sha')
    candidateBible.bundlePath = '/candidate/bible'
    const candidateStrong = strong('strong-new', 'new')
    candidateStrong.bundlePath = '/candidate/strong'

    const result = resolveBiblePublicationOverlay(
      [bible('old', 'old-sha'), strong('strong-old', 'old')],
      [candidateBible, candidateStrong],
      'LSG',
      2
    )

    assert.deepEqual(result.changedCatalogIds, ['bible-strong:LSG', 'bible:LSG'])
    assert.deepEqual(result.bundlePaths, ['/candidate/strong', '/candidate/bible'])
    assert.deepEqual(result.previousBundlePaths, [
      '/baseline/strong-strong-old',
      '/baseline/bible-old',
    ])
  })
  it('counts the resources the committed catalog lists', () => {
    const committedPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../../resource-catalog/src/mobile-resource-catalog.json'
    )
    const text = readFileSync(committedPath, 'utf8')
    const committed = JSON.parse(text) as RawPublicationCatalog
    assert.equal(
      catalogResourceCount(committed, 'committed'),
      Object.keys(committed.resources).length
    )
    // Carried entries are written back as parsed: the file must survive that round trip.
    assert.equal(`${JSON.stringify(committed, null, 2)}\n`, text)
    assert.throws(
      () => catalogResourceCount({ ...committed, resourceCount: 119 }, 'committed'),
      /BIBLE_PUBLICATION_CATALOG_COUNT_INVALID:committed:119/
    )
  })

  it('limits the Bible family to texts and their Strong and interlinear sidecars', () => {
    assert.deepEqual(
      [
        'bible:BHS',
        'bible-strong:KJV',
        'bible-interlinear:BHG:fr',
        'database:abbott:en',
        'strong-lexicon:core',
        'study-links',
      ].map(isBibleFamilyCatalogId),
      [true, true, true, false, false, false]
    )
  })
})

const familyCatalog = (): RawPublicationCatalog => ({
  format: 'bible-strong-mobile-resource-catalog',
  schemaVersion: 1,
  generatedAt: '2026-11-26T04:11:48.172Z',
  resourceCount: 3,
  resources: {
    'bible:BHS': { id: 'bible:BHS', archiveSha256: 'a'.repeat(64), entry: 'bible-hebrew.json' },
    'bible-strong:KJV': { id: 'bible-strong:KJV', archiveSha256: 'b'.repeat(64) },
    'database:abbott:en': {
      id: 'database:abbott:en',
      archiveSha256: 'c'.repeat(64),
      encryptedArchive: { sha256: 'd'.repeat(64) },
    },
  },
})

const manifest = (
  archiveSha256: string,
  revision: string,
  generatedAt = '2026-10-01T00:00:00.000Z'
) => ({
  format: 'bible-strong-resource-publication',
  revision,
  canonical: { sha256: `${revision}-canonical` },
  offlineArtifact: { sha256: archiveSha256 },
  provenance: { generatedAt },
})

describe('Bible-family baseline', () => {
  it('finds each family bundle by the archive the catalog delivers, ignoring other manifests', () => {
    const selected = selectBibleFamilyBaseline(familyCatalog(), [
      { bundlePath: '/outputs/releases/bhs', manifest: manifest('a'.repeat(64), 'bhs-1') },
      { bundlePath: '/outputs/releases/kjv-strong', manifest: manifest('b'.repeat(64), 'kjv-1') },
      { bundlePath: '/outputs/releases/bhs-draft', manifest: manifest('e'.repeat(64), 'bhs-2') },
      { bundlePath: '/outputs/images', manifest: { format: 'something-else' } },
      { bundlePath: '/outputs/broken', manifest: undefined },
    ])
    assert.deepEqual(
      [...selected],
      [
        ['bible-strong:KJV', '/outputs/releases/kjv-strong'],
        ['bible:BHS', '/outputs/releases/bhs'],
      ]
    )
  })

  it('keeps the latest copy of one publication found in several release folders', () => {
    const selected = selectBibleFamilyBaseline(familyCatalog(), [
      {
        bundlePath: '/outputs/a/bhs',
        manifest: manifest('a'.repeat(64), 'bhs-1', '2026-10-08T00:00:00.000Z'),
      },
      {
        bundlePath: '/outputs/b/bhs',
        manifest: manifest('a'.repeat(64), 'bhs-1', '2026-10-14T00:00:00.000Z'),
      },
      { bundlePath: '/outputs/kjv', manifest: manifest('b'.repeat(64), 'kjv-1') },
    ])
    assert.equal(selected.get('bible:BHS'), '/outputs/b/bhs')
  })

  it('fails closed on a missing or ambiguous family bundle', () => {
    assert.throws(
      () =>
        selectBibleFamilyBaseline(familyCatalog(), [
          { bundlePath: '/outputs/bhs', manifest: manifest('a'.repeat(64), 'bhs-1') },
        ]),
      /BIBLE_PUBLICATION_BASELINE_BUNDLE_MISSING:bible-strong:KJV$/
    )
    assert.throws(
      () =>
        selectBibleFamilyBaseline(familyCatalog(), [
          { bundlePath: '/outputs/a/bhs', manifest: manifest('a'.repeat(64), 'bhs-1') },
          { bundlePath: '/outputs/b/bhs', manifest: manifest('a'.repeat(64), 'bhs-other') },
          { bundlePath: '/outputs/kjv', manifest: manifest('b'.repeat(64), 'kjv-1') },
        ]),
      /BIBLE_PUBLICATION_BASELINE_BUNDLE_AMBIGUOUS:bible:BHS/
    )
  })
})

describe('candidate catalog of a Bible publication', () => {
  const candidateOf = (committed: RawPublicationCatalog) => {
    const candidate = structuredClone(committed)
    candidate.generatedAt = '2026-11-27T12:00:00.000Z'
    candidate.resources['bible:BHS'] = {
      id: 'bible:BHS',
      archiveSha256: 'f'.repeat(64),
      entry: 'bible-hebrew.json',
    }
    return candidate
  }

  it('accepts a change confined to the published entries', () => {
    const committed = familyCatalog()
    assert.doesNotThrow(() =>
      assertCandidateCatalogChangesOnly(committed, candidateOf(committed), ['bible:BHS'])
    )
  })

  it('rejects any change to an unrelated entry, its order, or an older catalog', () => {
    const committed = familyCatalog()
    const rewritten = candidateOf(committed)
    delete (rewritten.resources['database:abbott:en'] as Record<string, unknown>).encryptedArchive
    assert.throws(
      () => assertCandidateCatalogChangesOnly(committed, rewritten, ['bible:BHS']),
      /BIBLE_PUBLICATION_CANDIDATE_CATALOG_UNRELATED_CHANGE:database:abbott:en/
    )

    const reordered = candidateOf(committed)
    reordered.resources = Object.fromEntries(Object.entries(reordered.resources).reverse())
    assert.throws(
      () => assertCandidateCatalogChangesOnly(committed, reordered, ['bible:BHS']),
      /BIBLE_PUBLICATION_CANDIDATE_CATALOG_IDS_MISMATCH/
    )

    const older = candidateOf(committed)
    older.generatedAt = '2026-11-01T00:00:00.000Z'
    assert.throws(
      () => assertCandidateCatalogChangesOnly(committed, older, ['bible:BHS']),
      /BIBLE_PUBLICATION_CANDIDATE_CATALOG_OLDER/
    )

    assert.throws(
      () => assertCandidateCatalogChangesOnly(committed, candidateOf(committed), []),
      /BIBLE_PUBLICATION_CANDIDATE_CATALOG_UNRELATED_CHANGE:bible:BHS/
    )
  })
})

describe('firstCanonicalChapter', () => {
  it('reads the first chapter of a list of verses', () => {
    assert.deepEqual(firstCanonicalChapter({ verses: [{ book: 1, chapter: 1, verse: 1 }] }), {
      book: 1,
      chapter: 1,
      verse: 1,
    })
  })

  it('reads the first chapter of a Schema V4 object keyed by numbers', () => {
    assert.deepEqual(
      firstCanonicalChapter({ verses: { '10': { '2': {} }, '2': { '7': {}, '3': {} } } }),
      { book: 2, chapter: 3 }
    )
  })

  it('finds no chapter without verses', () => {
    assert.equal(firstCanonicalChapter({}), undefined)
    assert.equal(firstCanonicalChapter({ verses: {} }), undefined)
  })
})
