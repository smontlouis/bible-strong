import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { Effect } from 'effect'

import type { DictionaryRepositoryService } from '../../domain/dictionary'
import { makeResourceWebHandler } from '../app'

const repository: DictionaryRepositoryService = {
  browseDirectory: input =>
    Effect.succeed({
      items: [
        {
          key: 'c:dictionary-correspondence-ange',
          label: 'Ange',
          normalizedLabel: 'ange',
          correspondenceId: 'dictionary-correspondence-ange',
          sources: [
            {
              work: 'westphal',
              language: input.language,
              revision: 'dictionary-westphal-fr-r1',
              resourceId: 'WESTPHAL',
              title: 'Dictionnaire encyclopédique de la Bible',
              abbreviation: 'Westphal',
              id: 43,
              word: 'Ange',
              normalizedWord: 'ange',
            },
          ],
        },
      ],
      limit: input.limit ?? 100,
    }),
  listWorks: language =>
    Effect.succeed([
      {
        work: 'westphal',
        language: language ?? 'fr',
        revision: 'dictionary-westphal-fr-r1',
        resourceId: 'WESTPHAL',
        title: 'Dictionnaire encyclopédique de la Bible',
        abbreviation: 'Westphal',
        authors: ['Alexandre Westphal'],
        description: 'Encyclopédie biblique française.',
        edition: '1932–1935',
        source: 'levangile.com',
        attribution: 'Alexandre Westphal',
        onlineAccess: true,
        offlineDownload: true,
      },
    ]),
  listEntries: input =>
    Effect.succeed({
      work: input.work,
      language: input.language,
      revision: 'dictionary-westphal-fr-r1',
      entries: [{ id: 43, word: 'Ange', normalizedWord: 'ange' }],
      limit: input.limit ?? 50,
      ...(input.cursor ? {} : { nextCursor: encodeURIComponent(JSON.stringify(['ange', 43])) }),
    }),
  findEntry: input =>
    Effect.succeed({
      work: input.work,
      language: input.language,
      revision: 'dictionary-westphal-fr-r1',
      entry: { id: 43, word: input.word, definition: 'Définition' },
    }),
  findEntryById: input =>
    Effect.succeed({
      work: input.work,
      language: input.language,
      revision: 'dictionary-westphal-fr-r1',
      entry: { id: input.id, word: 'Ange', definition: 'Définition' },
    }),
  findEntries: input =>
    Effect.succeed({
      work: input.work,
      language: input.language,
      revision: 'dictionary-westphal-fr-r1',
      entries: input.words.map((word, index) => ({
        id: index + 1,
        word,
        definition: 'Définition',
      })),
    }),
  findVerseWords: input =>
    Effect.succeed({
      work: input.work,
      language: input.language,
      revision: 'dictionary-westphal-fr-r1',
      verseKey: input.verseKey,
      words: ['ange'],
    }),
  findPassageAnchors: input =>
    Effect.succeed({
      work: input.work,
      language: input.language,
      revision: 'dictionary-westphal-fr-r1',
      verseKey: input.verseKey,
      entries: [
        {
          id: 43,
          word: 'Ange',
          normalizedWord: 'ange',
          evidenceKind: 'source-citation' as const,
        },
      ],
    }),
  discoverPassageEntries: input =>
    Effect.succeed([
      {
        work: 'westphal',
        language: input.language ?? 'fr',
        revision: 'dictionary-westphal-fr-r1',
        resourceId: 'WESTPHAL',
        title: 'Dictionnaire encyclopédique de la Bible',
        abbreviation: 'Westphal',
        id: 43,
        word: 'Ange',
        normalizedWord: 'ange',
        evidenceKind: 'source-citation' as const,
        correspondenceId: 'dictionary-correspondence-ange',
      },
    ]),
}

describe('v1 Dictionary API', () => {
  it('lists independently identified dictionary works', async () => {
    const web = makeResourceWebHandler(undefined, undefined, { dictionary: repository })
    try {
      const response = await web.handler(
        new Request('http://localhost/v1/dictionaries?language=fr')
      )
      assert.equal(response.status, 200)
      const body = (await response.json()) as {
        dictionaries: Array<{ resource: { work: string }; title: string }>
      }
      assert.equal(body.dictionaries[0]?.resource.work, 'westphal')
      assert.equal(body.dictionaries[0]?.title, 'Dictionnaire encyclopédique de la Bible')
    } finally {
      await web.dispose()
    }
  })

  it('browses one global list while preserving exact source entries', async () => {
    const web = makeResourceWebHandler(undefined, undefined, { dictionary: repository })
    try {
      const response = await web.handler(
        new Request('http://localhost/v1/dictionaries/directory?language=fr&initial=a')
      )
      assert.equal(response.status, 200)
      const body = (await response.json()) as {
        items: Array<{ label: string; sources: Array<{ resource: { work: string }; id: number }> }>
      }
      assert.equal(body.items[0]?.label, 'Ange')
      assert.equal(body.items[0]?.sources[0]?.resource.work, 'westphal')
      assert.equal(body.items[0]?.sources[0]?.id, 43)
    } finally {
      await web.dispose()
    }
  })

  it('exposes keyset page tokens and accepts them on the following page', async () => {
    const web = makeResourceWebHandler(undefined, undefined, { dictionary: repository })
    try {
      const first = await web.handler(
        new Request('http://localhost/v1/dictionaries/westphal/fr/entries?initial=a&limit=1')
      )
      assert.equal(first.status, 200)
      const body = (await first.json()) as { nextCursor: string; entries: unknown[]; limit: number }
      assert.equal(body.limit, 1)
      assert.equal(body.entries.length, 1)
      assert.ok(body.nextCursor)

      const next = await web.handler(
        new Request(
          `http://localhost/v1/dictionaries/westphal/fr/entries?initial=a&limit=1&cursor=${encodeURIComponent(body.nextCursor)}`
        )
      )
      assert.equal(next.status, 200)
      assert.equal('nextCursor' in ((await next.json()) as object), false)
    } finally {
      await web.dispose()
    }
  })

  it('returns several definitions from one batch endpoint', async () => {
    const web = makeResourceWebHandler(undefined, undefined, { dictionary: repository })
    try {
      const response = await web.handler(
        new Request('http://localhost/v1/dictionaries/westphal/fr/entries/batch?words=amour%2Cange')
      )
      assert.equal(response.status, 200)
      const body = (await response.json()) as { entries: unknown[] }
      assert.equal(body.entries.length, 2)
    } finally {
      await web.dispose()
    }
  })

  it('discovers exact entries for a passage across active dictionaries', async () => {
    const web = makeResourceWebHandler(undefined, undefined, { dictionary: repository })
    try {
      const response = await web.handler(
        new Request('http://localhost/v1/dictionaries/verses/43-3-16/entries?language=fr')
      )
      assert.equal(response.status, 200)
      const body = (await response.json()) as {
        verseKey: string
        entries: Array<{ resource: { work: string }; id: number; correspondenceId?: string }>
      }
      assert.equal(body.verseKey, '43-3-16')
      assert.equal(body.entries[0]?.resource.work, 'westphal')
      assert.equal(body.entries[0]?.id, 43)
      assert.equal(body.entries[0]?.correspondenceId, 'dictionary-correspondence-ange')
    } finally {
      await web.dispose()
    }
  })

  it('rejects malformed page cursors', async () => {
    const web = makeResourceWebHandler(undefined, undefined, { dictionary: repository })
    try {
      const response = await web.handler(
        new Request('http://localhost/v1/dictionaries/westphal/fr/entries?cursor=not-a-cursor')
      )
      assert.equal(response.status, 400)
    } finally {
      await web.dispose()
    }
  })

  it('returns exact evidenced entries for a passage', async () => {
    const web = makeResourceWebHandler(undefined, undefined, { dictionary: repository })
    try {
      const response = await web.handler(
        new Request(
          'http://localhost/v1/dictionaries/westphal/fr/verses/43-3-16/entries'
        )
      )
      assert.equal(response.status, 200)
      const body = (await response.json()) as {
        entries: Array<{ id: number; word: string; evidenceKind: string }>
      }
      assert.deepEqual(body.entries, [
        { id: 43, word: 'Ange', normalizedWord: 'ange', evidenceKind: 'source-citation' },
      ])
    } finally {
      await web.dispose()
    }
  })
})
