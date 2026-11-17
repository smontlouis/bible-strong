import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BiblePageData } from './bible.functions'
import { buildBibleHead } from './bibleHead'

const page = (overrides: Partial<BiblePageData>): BiblePageData =>
  ({
    versionId: 'LSG',
    presentation: 'text',
    language: 'fr',
    book: 43,
    chapter: 3,
    description: 'Il y avait un homme d’entre les pharisiens…',
    inlineCommentaries: [],
    commentaryChoice: [],
    ...overrides,
  }) as BiblePageData

const robots = (data: BiblePageData) => {
  const meta = buildBibleHead(data).meta.find(meta => 'name' in meta && meta.name === 'robots')
  return meta && 'content' in meta ? meta.content : undefined
}

describe('Indexing of a Bible page', () => {
  it('indexes a chapter in every reading mode, and a single verse read as text', () => {
    expect(robots(page({}))).toBeUndefined()
    expect(robots(page({ presentation: 'strong' }))).toBeUndefined()
    expect(robots(page({ passage: { startVerse: 16 } }))).toBeUndefined()
  })

  it.each([
    { presentation: 'strong' },
    { presentation: 'reverse-interlinear' },
    { presentation: 'interlinear', versionId: 'BHG', gloss: 'fr' },
  ] as const)('leaves out a single verse read in the $presentation mode, which no sitemap names', reading => {
    expect(robots(page({ ...reading, passage: { startVerse: 16 } }))).toBe('noindex, follow')
  })

  it('leaves out verse ranges and the readings with commentaries', () => {
    expect(robots(page({ passage: { startVerse: 16, endVerse: 18 } }))).toBe('noindex, follow')
    expect(robots(page({ commentaryChoice: ['mhcc'] }))).toBe('noindex, follow')
    expect(
      robots(page({ commentaryChoice: ['mhy-fr'], inlineCommentaries: [{ id: 'mhy-fr', title: 'Matthew Henry' }] }))
    ).toBe('noindex, follow')
  })
})

const shareImage = (data: BiblePageData) =>
  buildBibleHead(data).meta.find(meta => 'property' in meta && meta.property === 'og:image')

describe('Share image of a Bible page', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('gives a verse range the image of its chapter, drawn once for every range', () => {
    vi.stubEnv('SHARE_CARD_SECRET', 'secret')
    const chapter = shareImage(page({}))
    expect(shareImage(page({ passage: { startVerse: 16, endVerse: 18 } }))).toEqual(chapter)
    expect(shareImage(page({ passage: { startVerse: 1, endVerse: 21 } }))).toEqual(chapter)
  })
})
