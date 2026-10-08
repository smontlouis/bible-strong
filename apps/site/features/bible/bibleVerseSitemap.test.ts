import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BiblePageData } from './bible.functions'
import { buildBibleHead } from './bibleHead'
import { BIBLE_VERSE_SITEMAPS, listBibleVerseSitemapUrls } from './bibleVerseSitemap'

// John 3 in a Bible that has no verse 4: three verses, numbered 1, 2, 3 and 5.
const stubResourceApi = (status = 200) => {
  vi.stubGlobal('fetch', async (input: URL) => {
    if (status !== 200) return new Response(null, { status })
    if (input.pathname.endsWith('/coverage')) {
      return new Response(
        JSON.stringify({
          canon: { id: 'protestant-66', orderedBooks: [43, 64] },
          books: [43, 64],
          chaptersByBook: { '43': [3], '64': [1] },
          verseCountByBookChapter: { '43-3': 4, '64-1': 2 },
        })
      )
    }
    const numbers = input.pathname.endsWith('/verses')
      ? [
          { book: 43, chapter: 3, number: 5 },
          { book: 64, chapter: 1, number: 2 },
        ]
      : [1, 2, 3, 5].map(number => ({ number }))
    return new Response(JSON.stringify({ verses: numbers }))
  })
}

afterEach(() => vi.unstubAllGlobals())

describe('BIBLE_VERSE_SITEMAPS', () => {
  it('has one file per well-known Bible of each language', () => {
    expect(Object.keys(BIBLE_VERSE_SITEMAPS)).toEqual([
      'bible-lsg-verses.xml',
      'bible-s21-verses.xml',
      'bible-bds-verses.xml',
      'bible-neg79-verses.xml',
      'bible-dby-verses.xml',
      'bible-kjv-verses.xml',
      'bible-niv-verses.xml',
      'bible-esv-verses.xml',
      'bible-nkjv-verses.xml',
      'bible-nlt-verses.xml',
    ])
  })
})

describe('listBibleVerseSitemapUrls', () => {
  it('lists the page of every verse the version numbers', async () => {
    stubResourceApi()

    expect(await listBibleVerseSitemapUrls('KJV')).toEqual([
      { loc: 'https://bible-strong.app/bible/kjv/john/3/1' },
      { loc: 'https://bible-strong.app/bible/kjv/john/3/2' },
      { loc: 'https://bible-strong.app/bible/kjv/john/3/3' },
      { loc: 'https://bible-strong.app/bible/kjv/john/3/5' },
      { loc: 'https://bible-strong.app/bible/kjv/3john/1/1' },
      { loc: 'https://bible-strong.app/bible/kjv/3john/1/2' },
    ])
  })

  it('lists a verse under the canonical address its page declares', async () => {
    stubResourceApi()
    const [first] = await listBibleVerseSitemapUrls('LXX_FR')

    const page = {
      versionId: 'LXX_FR',
      presentation: 'text',
      language: 'fr',
      book: 43,
      chapter: 3,
      passage: { startVerse: 1 },
      inlineCommentaries: [],
      description: '',
    } as unknown as BiblePageData
    const canonical = buildBibleHead(page).links.find(
      link => 'rel' in link && link.rel === 'canonical'
    )
    expect(first?.loc).toBe(canonical?.href)
    expect(first?.loc).toBe('https://bible-strong.app/bible/lxx-fr/john/3/1')
  })

  it('lists nothing for a version that is not published', async () => {
    stubResourceApi(404)

    expect(await listBibleVerseSitemapUrls('KJV')).toEqual([])
  })
})
