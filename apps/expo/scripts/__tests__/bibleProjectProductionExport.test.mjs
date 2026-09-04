import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPassageMediaPack, editionForLanguage } from '../lib/bibleProjectProductionExport.mjs'

const edition = language => ({
  id: `work:${language}`,
  language,
  provider: 'youtube',
  providerId: `youtube-${language}`,
  sourceUrl: `https://youtube.test/${language}`,
  title: language,
  thumbnailUrl: `https://img.test/${language}`,
  durationSeconds: 60,
  publishedAt: '2026-01-01T00:00:00Z',
  captionsAvailable: true,
})

const anchor = overrides => ({
  kind: 'passage',
  book: 1,
  chapterStart: 1,
  chapterEnd: 1,
  placement: 'after-range',
  relevance: 'primary',
  reviewStatus: 'reviewed',
  provenance: 'test',
  ...overrides,
})

const work = {
  id: 'work',
  category: 'theme',
  reviewStatus: 'reviewed',
  editions: [edition('fr'), edition('en')],
  anchors: [
    anchor({ chapterStart: 1, chapterEnd: 3 }),
    anchor({ chapterStart: 5, chapterEnd: 7, placement: 'chapter-resources' }),
    anchor({ kind: 'strong', code: 'H123', placement: 'strong-resource' }),
    anchor({ kind: 'library', placement: 'library' }),
  ],
}

test('builds deterministic chapter, Strong and library indexes', () => {
  const input = { manifests: [{ works: [work] }], generatedAt: '2026-01-01T00:00:00Z' }
  const first = buildPassageMediaPack(input)
  const second = buildPassageMediaPack(input)

  assert.deepEqual(first, second)
  assert.deepEqual(Object.keys(first.indexes.chapters), ['1:3', '1:5', '1:6', '1:7'])
  assert.deepEqual(first.indexes.strongs.H123, ['work'])
  assert.deepEqual(first.indexes.library, ['work'])
})

test('resolves only the requested route language without fallback', () => {
  const pack = buildPassageMediaPack({
    manifests: [{ works: [{ ...work, editions: [edition('fr')] }] }],
    generatedAt: '2026-01-01T00:00:00Z',
  })

  assert.equal(editionForLanguage(pack.works[0], 'fr').language, 'fr')
  assert.equal(editionForLanguage(pack.works[0], 'en'), undefined)
})

test('preserves curated secondary categories', () => {
  const pack = buildPassageMediaPack({
    manifests: [{ works: [{ ...work, categories: ['theme', 'how-to-read'] }] }],
    generatedAt: '2026-01-01T00:00:00Z',
  })

  assert.deepEqual(pack.works[0].categories, ['how-to-read', 'theme'])
})
