import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { Effect } from 'effect'

import {
  SupplementaryContentNotFound,
  type SupplementaryRepositoryService,
} from '../../domain/supplementary'
import { makeResourceWebHandler } from '../app'

const supplementary: SupplementaryRepositoryService = {
  findCommentaryCoverage: input =>
    Effect.succeed({
      ...input,
      revision: 'barnes-fr-r1',
      books: [1, 19, 41],
      chaptersByBook: { 1: [1, 2], 19: [1], 41: [1, 2, 3] },
    }),
  findCommentaryVerse: input =>
    Effect.fail(
      new SupplementaryContentNotFound({
        resourceIdentity: `commentary:${input.collection}:${input.language}`,
        verseKey: input.verseKey,
      })
    ),
  findCommentaryChapter: input =>
    Effect.fail(
      new SupplementaryContentNotFound({
        resourceIdentity: `commentary:${input.collection}:${input.language}`,
      })
    ),
  findCrossReferences: input =>
    Effect.fail(
      new SupplementaryContentNotFound({
        resourceIdentity: `cross-references:${input.language}`,
        verseKey: input.verseKey,
      })
    ),
}

describe('v1 commentary coverage API', () => {
  it('returns one compact revisioned coverage document', async () => {
    const web = makeResourceWebHandler(undefined, undefined, { supplementary })
    try {
      const response = await web.handler(
        new Request('http://localhost/v1/commentaries/barnes/fr/coverage', {
          headers: { 'x-request-id': 'commentary-coverage-test' },
        })
      )

      assert.equal(response.status, 200)
      assert.match(response.headers.get('etag') ?? '', /^"[a-f0-9]{64}"$/u)
      assert.deepEqual(await response.json(), {
        resource: {
          kind: 'commentary',
          resourceId: 'barnes',
          language: 'fr',
          revision: 'barnes-fr-r1',
        },
        books: [1, 19, 41],
        chaptersByBook: { 1: [1, 2], 19: [1], 41: [1, 2, 3] },
      })
    } finally {
      await web.dispose()
    }
  })
})
