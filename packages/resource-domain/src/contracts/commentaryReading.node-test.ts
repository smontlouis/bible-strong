import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as Schema from 'effect/Schema'
import {
  buildCommentaryResourceSections,
  buildCommentaryReadingSections,
  buildNormalizedCommentaryReadingSections,
  createCommentaryReadingIndex,
} from './commentarySections'
import {
  CommentaryReadingIndexRequest,
  CommentaryReadingIndexResponse,
  CommentaryReadingSectionRequest,
} from './commentaryReadingContract'

const entry = { id: 'test', publicationId: 'test' }

test('normalized documents preserve expanded section IDs and content without repeated HTML strings', () => {
  const documents = [
    { id: 'a', content: '<p>One.</p><hr><p>Two.</p>' },
    { id: 'b', content: '<p>Other.</p>' },
  ]
  const associations = [
    { verse: 1, documentId: 'a', ordinal: 0 },
    { verse: 1, documentId: 'b', ordinal: 1 },
    { verse: 2, documentId: 'a', ordinal: 0 },
    { verse: 4, documentId: 'a', ordinal: 0 },
  ]
  const input = { entry, language: 'en' as const, book: 1, chapter: 1 }
  assert.deepEqual(
    buildNormalizedCommentaryReadingSections({ ...input, documents, associations }),
    buildCommentaryReadingSections({
      ...input,
      comments: {
        1: `${documents[0].content}<hr>${documents[1].content}`,
        2: documents[0].content,
        4: documents[0].content,
      },
    })
  )
})

test('EGW reading sections preserve gaps without changing legacy detail grouping', () => {
  const fragment = (position: number) =>
    `<h3>Patriarchs</h3><h4>Creation</h4><p>Paragraph ${position}</p><p><a class="external-source" href="https://egwwritings.org/read/84.${position}">Read context</a></p>`
  const input = {
    entry: { id: 'egw-writings', publicationId: 'egw-writings' },
    language: 'en' as const,
    book: 1,
    chapter: 1,
    comments: { 1: fragment(1), 2: fragment(2), 5: fragment(5) },
  }
  assert.equal(buildCommentaryResourceSections(input).length, 1)
  const sections = buildCommentaryReadingSections(input)
  assert.deepEqual(
    sections.map(s => [s.rangeStartVerse, s.rangeEndVerse]),
    [
      [1, 2],
      [5, 5],
    ]
  )
  assert.match(sections[0].content, /Paragraph 1/)
  assert.match(sections[0].content, /Paragraph 2/)
  assert.doesNotMatch(sections[0].content, /Paragraph 5/)
  assert.equal(new Set(sections.map(s => s.id)).size, 2)
})

test('builds stable sections once per contiguous passage, keeping introductions distinct', () => {
  const sections = buildCommentaryResourceSections({
    entry,
    language: 'fr',
    book: 1,
    chapter: 1,
    comments: {
      0: '<p>Introduction</p>',
      1: '<p>One &amp; two</p>',
      2: '<p>One &amp; two</p>',
      4: '<p>One &amp; two</p>',
    },
  })
  assert.deepEqual(
    sections.map(s => [s.id, s.rangeStartVerse, s.rangeEndVerse]),
    [
      ['test-fr-1-1-0-0', 0, 0],
      ['test-fr-1-1-1-2', 1, 2],
      ['test-fr-1-1-4-4', 4, 4],
    ]
  )
  const index = createCommentaryReadingIndex(sections)
  assert.equal(index[1].excerpt, 'One & two')
  assert.ok(index.every(item => !('content' in item)))
})

test('keeps distinct sections on the same range addressable and bounds excerpts', () => {
  const sections = buildCommentaryResourceSections({
    entry,
    language: 'en',
    book: 1,
    chapter: 1,
    comments: { 1: `<p>${'Long content '.repeat(1000)}</p><hr/><p>Another section</p>` },
  })
  assert.equal(new Set(sections.map(s => s.id)).size, 2)
  assert.equal(createCommentaryReadingIndex(sections)[0].excerpt.length <= 160, true)
  const response = {
    book: 1,
    chapter: 1,
    indexes: [
      {
        resource: { kind: 'commentary', resourceId: 'test', language: 'en', revision: 'r1' },
        sections: createCommentaryReadingIndex(sections),
      },
    ],
    unavailable: [],
  }
  Schema.decodeUnknownSync(CommentaryReadingIndexResponse)(response)
})

test('requires a revision for full content and bounds batch size', () => {
  assert.throws(() =>
    Schema.decodeUnknownSync(CommentaryReadingSectionRequest)({
      resourceId: 'test',
      language: 'fr',
      book: 1,
      chapter: 1,
      sectionId: 'id',
    })
  )
  assert.throws(() =>
    Schema.decodeUnknownSync(CommentaryReadingIndexRequest)({
      book: 1,
      chapter: 1,
      resources: Array.from({ length: 6 }, () => ({ resourceId: 'test', language: 'fr' })),
    })
  )
})
