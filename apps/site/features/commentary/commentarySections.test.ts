import { describe, expect, it } from 'vitest'
import {
  buildCommentarySections,
  commentaryVerseRange,
  decodeCommentaryChapter,
  groupCommentarySectionsByRange,
  paginateCommentarySections,
} from './commentarySections'

const ranges = (sections: { slug: string }[]) => sections.map(section => section.slug)

describe('Commentary chapter decoding', () => {
  it('reads HTML by verse number', () => {
    expect(decodeCommentaryChapter('{"1":"<p>a</p>","16":"b"}')).toEqual({
      '1': '<p>a</p>',
      '16': 'b',
    })
  })

  it('leaves out anything that is not a comment on a verse', () => {
    expect(decodeCommentaryChapter('{"1":"a","x":"b","2":3,"3":["c"]}')).toEqual({ '1': 'a' })
    expect(decodeCommentaryChapter('["a"]')).toEqual({})
    expect(decodeCommentaryChapter('not json')).toEqual({})
  })
})

describe('Commentary sections', () => {
  it('reads a comment repeated on consecutive verses as one section', () => {
    const sections = buildCommentarySections('mhy-fr', {
      '1': 'Nicodème',
      '2': 'Nicodème',
      '3': 'Nicodème',
      '4': 'Jean-Baptiste',
    })
    expect(sections).toEqual([
      { slug: '1-3', startVerse: 1, endVerse: 3, content: 'Nicodème' },
      { slug: '4-4', startVerse: 4, endVerse: 4, content: 'Jean-Baptiste' },
    ])
  })

  it('orders verses by number, not as text', () => {
    expect(ranges(buildCommentarySections('wesley', { '10': 'b', '2': 'a' }))).toEqual([
      '2-2',
      '10-10',
    ])
  })

  it('starts a new section where the same comment resumes after a gap', () => {
    expect(ranges(buildCommentarySections('jfb', { '1': 'a', '2': 'b', '3': 'a' }))).toEqual([
      '1-1',
      '2-2',
      '3-3',
    ])
  })

  it('splits the comments of a verse on rules and ranks those sharing a range', () => {
    const sections = buildCommentarySections('rashi-en', {
      '1': '<b>A song</b> first<hr><b>my shepherd</b> second<hr />third',
    })
    expect(sections.map(({ slug, content }) => [slug, content])).toEqual([
      ['1-1', '<b>A song</b> first'],
      ['1-1-2', '<b>my shepherd</b> second'],
      ['1-1-3', 'third'],
    ])
  })

  it('keeps an overview spanning the chapter before the comments it introduces', () => {
    const sections = buildCommentarySections('jfb', {
      '1': 'overview<hr>one',
      '2': 'overview<hr>two',
      '3': 'overview',
    })
    expect(ranges(sections)).toEqual(['1-3', '1-1', '2-2'])
  })

  it('files the introduction of a chapter under verse 0', () => {
    expect(buildCommentarySections('mhc', { '0': 'intro', '1': 'one' })[0]).toMatchObject({
      slug: '0-0',
      startVerse: 0,
      endVerse: 0,
    })
  })
})

describe('Anthology sections', () => {
  const excerpt = (book: string, chapter: string, text: string, position: string) =>
    `<h3>${book}</h3><h4>${chapter}</h4><p>${text}</p><p><a class="external-source" href="https://text.egwwritings.org/read/${position}">View in context</a></p>`

  it('regroups the excerpts of one document in the order of the document', () => {
    const sections = buildCommentarySections('egw-writings', {
      '3': excerpt('Steps to Christ', 'Chapter 2', 'later', '108.90'),
      '16': `${excerpt('Steps to Christ', 'Chapter 2', 'earlier', '108.75')}<hr>${excerpt('Education', 'Chapter 1', 'other', '29.10')}`,
    })
    expect(sections).toHaveLength(2)
    expect(sections[0]).toMatchObject({ slug: '3-3', startVerse: 3, endVerse: 16 })
    expect(sections[0]?.content).toBe(
      '<h3>Steps to Christ</h3><h4>Chapter 2</h4><p>earlier</p><br /><br /><p>later</p><p><a class="external-source" href="https://text.egwwritings.org/read/108.90">View in context</a></p>'
    )
    expect(sections[1]).toMatchObject({ slug: '16-16-2', startVerse: 16, endVerse: 16 })
  })

  it('reads once an excerpt quoted on verses that do not follow each other', () => {
    const quoted = excerpt('Steps to Christ', 'Chapter 2', 'quoted', '108.75')
    const sections = buildCommentarySections('egw-writings', { '3': quoted, '7': quoted })
    expect(sections).toHaveLength(1)
    expect(sections[0]).toMatchObject({ slug: '3-3', startVerse: 3, endVerse: 7 })
    expect(sections[0]?.content.match(/quoted/gu)).toHaveLength(1)
  })

  it('only regroups the anthology, whatever another commentary quotes', () => {
    const comments = {
      '3': excerpt('Steps to Christ', 'Chapter 2', 'later', '108.90'),
      '16': excerpt('Steps to Christ', 'Chapter 2', 'earlier', '108.75'),
    }
    expect(buildCommentarySections('sdabc', comments)).toHaveLength(2)
  })
})

describe('Commentary pages', () => {
  const section = (length: number) => ({ content: 'x'.repeat(length) })

  it('keeps a chapter on one page while it fits', () => {
    expect(paginateCommentarySections([section(40), section(40)], 100)).toHaveLength(1)
    expect(paginateCommentarySections([], 100)).toEqual([])
  })

  it('continues a section longer than a page on its headings', () => {
    const part = (title: string, length: number) => `<h4>${title}</h4>${'x'.repeat(length)}`
    const long = { slug: '1-1', content: `intro ${part('A', 40)}${part('B', 40)}${part('C', 150)}${part('D', 10)}` }
    const pages = paginateCommentarySections([{ slug: '0-0', content: 'x'.repeat(30) }, long], 100)
    // The first part still fits after the introduction; no page carries two parts.
    expect(pages.map(page => page.map(({ slug }) => slug))).toEqual([
      ['0-0', '1-1'],
      ['1-1'],
      ['1-1'],
      ['1-1'],
    ])
    const parts = pages.map(page => page[page.length - 1]?.content ?? '')
    expect(parts.map(content => content.slice(0, 10))).toEqual([
      'intro <h4>',
      '<h4>B</h4>',
      '<h4>C</h4>',
      '<h4>D</h4>',
    ])
    // Nothing is lost between the parts.
    expect(parts.join('')).toBe(long.content)
  })

  it('keeps whole a long section that has no heading to continue on', () => {
    expect(paginateCommentarySections([{ content: 'x'.repeat(250) }], 100)).toHaveLength(1)
  })

  it('opens a page rather than exceed the budget, without splitting a section', () => {
    const pages = paginateCommentarySections(
      [section(60), section(60), section(250), section(10), section(80)],
      100
    )
    expect(pages.map(page => page.map(({ content }) => content.length))).toEqual([
      [60],
      [60],
      [250],
      [10, 80],
    ])
  })
})

describe('Commentary verse ranges', () => {
  it('gathers consecutive sections on the same verses', () => {
    const groups = groupCommentarySectionsByRange([
      { slug: '1-1', startVerse: 1, endVerse: 1 },
      { slug: '1-1-2', startVerse: 1, endVerse: 1 },
      { slug: '1-3', startVerse: 1, endVerse: 3 },
      { slug: '2-2', startVerse: 2, endVerse: 2 },
    ])
    expect(groups.map(group => ranges(group.sections))).toEqual([['1-1', '1-1-2'], ['1-3'], ['2-2']])
  })

  it('writes a verse, a range, and no verse for an introduction', () => {
    expect(commentaryVerseRange({ startVerse: 16, endVerse: 16 })).toBe('16')
    expect(commentaryVerseRange({ startVerse: 1, endVerse: 21 })).toBe('1-21')
    expect(commentaryVerseRange({ startVerse: 0, endVerse: 0 })).toBeUndefined()
    // An overview filed from the introduction onwards comments the first verses.
    expect(commentaryVerseRange({ startVerse: 0, endVerse: 6 })).toBe('1-6')
    expect(commentaryVerseRange({ startVerse: 0, endVerse: 1 })).toBe('1')
  })
})
