import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildCommentaryChapterSections,
  closestCommentarySection,
} from './commentaryChapterSections'

const slugs = (sections: { slug: string }[]) => sections.map(section => section.slug)

describe('Commentary chapter sections', () => {
  it('reads a comment repeated on consecutive verses as one section', () => {
    assert.deepEqual(
      buildCommentaryChapterSections('mhy-fr', {
        '1': 'Nicodème',
        '2': 'Nicodème',
        '3': 'Nicodème',
        '4': 'Jean-Baptiste',
      }),
      [
        { slug: '1-3', startVerse: 1, endVerse: 3, content: 'Nicodème' },
        { slug: '4-4', startVerse: 4, endVerse: 4, content: 'Jean-Baptiste' },
      ]
    )
  })

  it('orders verses by number and starts a new section after a gap', () => {
    assert.deepEqual(slugs(buildCommentaryChapterSections('wesley', { '10': 'b', '2': 'a' })), [
      '2-2',
      '10-10',
    ])
    assert.deepEqual(
      slugs(buildCommentaryChapterSections('jfb', { '1': 'a', '2': 'b', '3': 'a' })),
      ['1-1', '2-2', '3-3']
    )
  })

  it('splits the comments of a verse on rules and ranks those sharing a range', () => {
    assert.deepEqual(
      buildCommentaryChapterSections('rashi-en', {
        '1': '<b>A song</b> first<hr><b>my shepherd</b> second<hr />third',
      }).map(({ slug, content }) => [slug, content]),
      [
        ['1-1', '<b>A song</b> first'],
        ['1-1-2', '<b>my shepherd</b> second'],
        ['1-1-3', 'third'],
      ]
    )
  })

  it('keeps an overview before the comments it introduces, and the introduction under 0', () => {
    assert.deepEqual(
      slugs(
        buildCommentaryChapterSections('jfb', {
          '0': 'intro',
          '1': 'overview<hr>one',
          '2': 'overview<hr>two',
          '3': 'overview',
        })
      ),
      ['0-0', '1-3', '1-1', '2-2']
    )
  })

  const excerpt = (book: string, chapter: string, text: string, position: string) =>
    `<h3>${book}</h3><h4>${chapter}</h4><p>${text}</p><p><a class="external-source" href="https://text.egwwritings.org/read/${position}">View in context</a></p>`

  it('regroups the excerpts of one document of the anthology, in the order of the document', () => {
    const comments = {
      '3': excerpt('Steps to Christ', 'Chapter 2', 'later', '108.90'),
      '16': `${excerpt('Steps to Christ', 'Chapter&nbsp;2', 'earlier', '108.75')}<hr>${excerpt('Education', 'Chapter 1', 'other', '29.10')}`,
      '20': excerpt('Steps to Christ', 'Chapter 2', 'later', '108.90'),
    }
    const sections = buildCommentaryChapterSections('egw-writings', comments)
    assert.deepEqual(
      sections.map(({ slug, startVerse, endVerse }) => [slug, startVerse, endVerse]),
      [
        ['3-3', 3, 20],
        ['16-16-2', 16, 16],
      ]
    )
    // An excerpt quoted on verses that do not follow each other is read once.
    assert.equal(
      sections[0]?.content,
      '<h3>Steps to Christ</h3><h4>Chapter 2</h4><p>earlier</p><br /><br /><p>later</p><p><a class="external-source" href="https://text.egwwritings.org/read/108.90">View in context</a></p>'
    )
    // Another commentary quoting the same documents keeps its sections.
    assert.equal(buildCommentaryChapterSections('sdabc', comments).length, 4)
  })
})

describe('The comment closest to a verse', () => {
  const run = (startVerse: number, endVerse: number) => ({ startVerse, endVerse })

  it('prefers the comment on the fewest verses', () => {
    assert.deepEqual(
      closestCommentarySection([run(1, 21), run(14, 18), run(16, 16)], 16),
      run(16, 16)
    )
    assert.deepEqual(closestCommentarySection([run(1, 21), run(14, 18)], 17), run(14, 18))
  })

  it('prefers, among comments on as many verses, the one that starts last, then the first read', () => {
    assert.deepEqual(closestCommentarySection([run(14, 16), run(16, 18)], 16), run(16, 18))
    const [first, second] = [
      { ...run(16, 16), slug: '16-16' },
      { ...run(16, 16), slug: '16-16-2' },
    ]
    assert.equal(closestCommentarySection([first, second], 16), first)
  })

  it('finds nothing where no comment covers the verse', () => {
    assert.equal(closestCommentarySection([run(0, 0), run(1, 5)], 16), undefined)
    // The introduction of a chapter covers no verse.
    assert.equal(closestCommentarySection([run(0, 0)], 0), undefined)
  })
})
