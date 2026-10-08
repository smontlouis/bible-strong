import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readResource } from '../resources/resourceApi'
import { loadBiblePage } from './bible.functions'

vi.mock('../resources/resourceApi', () => ({ readResource: vi.fn() }))
// A server function is its handler here: the tests call it as the route does.
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => {
    const builder = {
      validator: () => builder,
      handler: (handle: (context: { data: unknown }) => unknown) => handle,
    }
    return builder
  },
}))

// Matthew 17 as a Bible that keeps the number of verse 21 and leaves it blank.
const TEXTS: Record<number, string> = {
  19: 'Then the disciples came to Jesus',
  20: 'He replied, “Because you have so little faith.”',
  21: '\n ',
  22: 'When they came together in Galilee',
  23: 'They will kill him',
}

const coverage = (versionId: string) => ({
  resource: { kind: 'bible-text', versionId, revision: 'r1', textRevision: 'r1' },
  canon: { id: 'protestant-66', orderedBooks: [40] },
  versification: 'bible-strong-default',
  books: [40],
  chaptersByBook: { '40': [17] },
  verseCountByBookChapter: { '40-17': 23 },
})

const chapter = (versionId: string) => ({
  resource: { versionId },
  book: 40,
  chapter: 17,
  verses: Object.entries(TEXTS).map(([number, text]) => ({
    number: Number(number),
    text,
    presentation: { startTags: [], layout: [], notes: [], headings: [] },
  })),
})

/** Every Bible reads Matthew 17 that way; what is read around the text does not exist. */
const stubResourceApi = () => {
  vi.mocked(readResource).mockImplementation(async path => {
    const [, versionId, document] = /^\/v1\/bibles\/([^/]+)\/(.+)$/u.exec(path) ?? []
    if (versionId && document === 'coverage') return coverage(versionId) as never
    if (versionId && document === 'books/40/chapters/17') return chapter(versionId) as never
    return undefined as never
  })
}

const load = (path: string) => loadBiblePage({ data: { path } })

// A single verse in each reading mode: the text, the Strong numbers, both interlinears.
const READING_MODES = [
  'niv/matt/17',
  'kjv/strong/matt/17',
  'kjv/reverse-interlinear/matt/17',
  'bhg/interlinear/en/matt/17',
]

beforeEach(() => {
  vi.mocked(readResource).mockReset()
  stubResourceApi()
})

describe('loadBiblePage', () => {
  it.each(READING_MODES)('has a page for a verse of %s that has text', async chapterPath => {
    expect(await load(`${chapterPath}/20`)).toMatchObject({ passage: { startVerse: 20 } })
  })

  it.each(READING_MODES)('has no page for a verse %s leaves blank', async chapterPath => {
    await expect(load(`${chapterPath}/21`)).rejects.toMatchObject({ isNotFound: true })
  })

  it.each(READING_MODES)('has no page for a verse %s does not number', async chapterPath => {
    await expect(load(`${chapterPath}/24`)).rejects.toMatchObject({ isNotFound: true })
  })

  it('still reads the chapter, which goes on past the blank verse without a link to it', async () => {
    const page = await load('niv/matt/17')

    expect(page.html).toContain('id="v20"')
    expect(page.html).toContain('id="v22"')
    expect(page.html).not.toContain('/bible/niv/matt/17/21')
  })

  it('neither quotes a blank verse beside its neighbours nor leads to it', async () => {
    const before = await load('niv/matt/17/22')
    const after = await load('niv/matt/17/20')

    expect(before.study?.context.before.map(verse => verse.verse)).toEqual([20])
    expect(after.study?.context.after.map(verse => verse.verse)).toEqual([22])
    expect(after.study?.context.before.map(verse => verse.verse)).toEqual([19])
  })

  it('still reads a range of verses that holds a blank one', async () => {
    expect(await load('niv/matt/17/20-22')).toMatchObject({
      passage: { startVerse: 20, endVerse: 22 },
    })
  })
})
