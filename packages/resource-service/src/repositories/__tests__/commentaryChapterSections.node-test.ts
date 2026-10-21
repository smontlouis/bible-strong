import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildCommentaryChapterSections } from '@bible-strong/resource-domain/commentary-chapter-sections'

import { commentaryChapterSectionRows } from '../commentaryChapterSections'

describe('Commentary chapter section rows', () => {
  it('writes the sections the site builds, in their order', () => {
    const comments = {
      '0': 'Introduction',
      '15': 'Overview<hr>That whosoever',
      '16': 'Overview<hr>For God so loved<hr>The world',
      '17': 'Overview',
    }
    const rows = commentaryChapterSectionRows({
      publicationId: 7,
      resourceIdentity: 'commentary:barnes:en',
      book: 43,
      chapter: 3,
      comments,
    })
    assert.deepEqual(
      rows.map(({ ordinal, slug, start_verse, end_verse, content }) => ({
        ordinal,
        slug,
        startVerse: start_verse,
        endVerse: end_verse,
        content,
      })),
      buildCommentaryChapterSections('barnes', comments).map((section, ordinal) => ({
        ordinal,
        ...section,
      }))
    )
    assert.ok(rows.every(row => row.publication_id === 7 && row.book === 43 && row.chapter === 3))
  })

  it('reads the comments of verses 0 to 200 only, as a verse page asks for them', () => {
    const rows = commentaryChapterSectionRows({
      publicationId: 7,
      resourceIdentity: 'commentary:aquifer-fr:fr',
      book: 46,
      chapter: 10,
      comments: { '1': 'First', '200': 'Last', '201': 'Beyond', '542': 'Far', '07': 'Padded' },
    })
    assert.deepEqual(
      rows.map(row => row.slug),
      ['1-1', '200-200']
    )
  })

  it('builds the anthology read by source document by its collection', () => {
    const egw = (section: string, href: string, body: string) =>
      `<h3>The Desire of Ages</h3><h4>${section}</h4><p>${body}</p><p><a class="external-source" href="${href}">Context</a></p>`
    const comments = {
      '1': egw('Chapter 1', 'https://egwwritings.org/read/130.5', 'One'),
      '3': egw('Chapter 1', 'https://egwwritings.org/read/130.9', 'Three'),
    }
    const sections = (resourceIdentity: string) =>
      commentaryChapterSectionRows({
        publicationId: 1,
        resourceIdentity,
        book: 43,
        chapter: 1,
        comments,
      }).length
    assert.equal(sections('commentary:egw-writings:en'), 1)
    assert.equal(sections('commentary:barnes:en'), 2)
  })
})
