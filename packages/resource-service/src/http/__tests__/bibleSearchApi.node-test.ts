import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { Effect } from 'effect'

import type { BibleSearchInput, BibleSearchRepositoryService } from '../../domain/bibleSearch'
import { makeResourceWebHandler } from '../app'

describe('v1 aggregate Bible search API', () => {
  it('searches all requested versions through one repository operation', async () => {
    let receivedInput: (Omit<BibleSearchInput, 'versionId'> & { versionIds: string[] }) | undefined
    const bibleSearch = {
      search: () => Effect.die('single-version search should not be called'),
      searchMany: (input: Omit<BibleSearchInput, 'versionId'> & { versionIds: string[] }) => {
        receivedInput = input
        return Effect.succeed({
          resources: input.versionIds.map(versionId => ({
            versionId,
            revision: `${versionId.toLowerCase()}-r1`,
            textRevision: `${versionId.toLowerCase()}-r1`,
          })),
          count: 1,
          results: [
            {
              version: 'LSG',
              book: 43,
              chapter: 3,
              verse: 16,
              text: 'Car Dieu a tant aimé le monde',
              highlighted: 'Car {{Dieu}} a tant aimé le monde',
            },
          ],
        })
      },
    } as unknown as BibleSearchRepositoryService
    const web = makeResourceWebHandler(undefined, undefined, { bibleSearch })

    try {
      const response = await web.handler(
        new Request(
          'http://localhost/v1/bibles/search?q=Dieu&versions=LSG,DBY&canon=catholic-73&limit=20&sortOrder=book'
        )
      )

      if (response.status !== 200) throw new Error(await response.clone().text())
      assert.deepEqual(receivedInput?.versionIds, ['LSG', 'DBY'])
      assert.equal(receivedInput?.query, 'Dieu')
      assert.equal(receivedInput?.limit, 20)
      assert.equal(receivedInput?.sortOrder, 'book')
      assert.equal(receivedInput?.canon, 'catholic-73')
      assert.deepEqual(await response.json(), {
        resources: [
          {
            kind: 'bible-text',
            versionId: 'LSG',
            revision: 'lsg-r1',
            textRevision: 'lsg-r1',
          },
          {
            kind: 'bible-text',
            versionId: 'DBY',
            revision: 'dby-r1',
            textRevision: 'dby-r1',
          },
        ],
        count: 1,
        results: [
          {
            version: 'LSG',
            book: 43,
            chapter: 3,
            verse: 16,
            text: 'Car Dieu a tant aimé le monde',
            highlighted: 'Car {{Dieu}} a tant aimé le monde',
          },
        ],
      })
    } finally {
      await web.dispose()
    }
  })
})

it('routes standard and semantic searches independently, for one or several versions', async () => {
  const modes: unknown[] = []
  const bibleSearch: BibleSearchRepositoryService = {
    search: input => {
      modes.push(input.mode)
      return Effect.succeed({
        versionId: 'LSG',
        revision: 'r1',
        textRevision: 'r1',
        count: 0,
        results: [],
      })
    },
    searchMany: input => {
      modes.push(input.mode)
      return Effect.succeed({ resources: [], count: 0, results: [] })
    },
  }
  const web = makeResourceWebHandler(undefined, undefined, { bibleSearch })
  try {
    for (const path of ['LSG/search', 'LSG/semantic-search', 'search', 'semantic-search']) {
      const response = await web.handler(
        new Request(`http://localhost/v1/bibles/${path}?q=enfance&versions=LSG`)
      )
      assert.equal(response.status, 200, await response.text())
    }
    assert.deepEqual(modes, ['standard', 'semantic', 'standard', 'semantic'])
  } finally {
    await web.dispose()
  }
})
