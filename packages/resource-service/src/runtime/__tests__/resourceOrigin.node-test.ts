import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { Context, Effect } from 'effect'
import type { PostgresPool } from 'kysely'

import { reportFirstConnection } from '../../database/hyperdriveDatabase'
import { BibleChapterRepository } from '../../domain/bibleChapter'
import { NaveRepository, type NaveRepositoryService } from '../../domain/nave'
import {
  makeResourceRequestServices,
  makeResourceWebHandler,
  makeSharedResourceWebHandler,
  type ResourceRequestServices,
} from '../../http/app'
import {
  readResourceOrigin,
  resourceApplicationFor,
  resourceRequestServicesFor,
  type ResourceOriginRead,
} from '../resourceOrigin'

const topicUrl = 'https://api.bible-strong.app/v1/naves/fr/topics/aaron'

// A Nave repository that says whose it is, and can be made to wait.
const naveRepositoryOf = (
  owner: string,
  calls: string[],
  until: Promise<void> = Promise.resolve()
): NaveRepositoryService => ({
  findTopic: input =>
    Effect.promise(async () => {
      calls.push(`${owner}:started`)
      await until
      calls.push(`${owner}:answered`)
      return {
        language: input.language,
        revision: `revision-of-${owner}`,
        topic: { normalizedName: input.normalizedName, name: owner, initial: 'a', description: '' },
      }
    }),
  listTopics: () => Effect.die('unused'),
  findVerseTopics: () => Effect.die('unused'),
  findRandomTopic: () => Effect.die('unused'),
})

const originRead = (request: Request, overrides: Partial<ResourceOriginRead> = {}) => ({
  request,
  corsAllowedOrigins: ['https://bible-strong.app'],
  // Nothing listens there: these tests never open a database connection.
  hyperdriveConnectionString: 'postgresql://nobody:nothing@127.0.0.1:1/none',
  runTopicEmbedding: async () => ({}),
  searchProductAnalytics: { writeDataPoint: () => undefined },
  analyticsEnabled: false,
  environment: 'test',
  writeRuntimeEvent: () => undefined,
  onSqlStatement: () => undefined,
  ...overrides,
})

describe('Resource origin', () => {
  it('gives two concurrent requests of one application their own repositories', async () => {
    const calls: string[] = []
    let releaseFirst = () => undefined as void
    const firstMayAnswer = new Promise<void>(resolve => {
      releaseFirst = resolve
    })
    const web = makeSharedResourceWebHandler()
    const read = (repository: NaveRepositoryService) =>
      web.handler(new Request(topicUrl), makeResourceRequestServices(undefined, repository))

    // The first request is still waiting for its repository when the second is answered.
    const first = read(naveRepositoryOf('first', calls, firstMayAnswer))
    const second = await read(naveRepositoryOf('second', calls))
    releaseFirst()

    assert.equal((await second.json()).resource.revision, 'revision-of-second')
    assert.equal((await (await first).json()).resource.revision, 'revision-of-first')
    assert.deepEqual(calls, [
      'first:started',
      'second:started',
      'second:answered',
      'first:answered',
    ])
    await web.dispose()
  })

  it('keeps no repository of a request for the next one', async () => {
    const web = makeSharedResourceWebHandler()

    const withRepository = await web.handler(
      new Request(topicUrl),
      makeResourceRequestServices(undefined, naveRepositoryOf('first', []))
    )
    const without = await web.handler(new Request(topicUrl), makeResourceRequestServices())

    assert.equal(withRepository.status, 200)
    // The application itself only knows the repositories that have no publication.
    assert.equal(without.status, 503)
    assert.equal((await without.json()).code, 'NAVE_PUBLICATION_INACTIVE')
    await web.dispose()
  })

  it('answers like an application built for the request', async () => {
    const options = { corsAllowedOrigins: ['https://bible-strong.app'] }
    const repository = naveRepositoryOf('same', [])
    const shared = makeSharedResourceWebHandler(options)
    const requests: [string, string, Record<string, string>][] = [
      ['GET', topicUrl, { origin: 'https://bible-strong.app', 'x-request-id': 'same_answer' }],
      ['GET', topicUrl, { 'x-request-id': 'no_origin' }],
      // Refused by the request schema: mapped to the invalid-request problem.
      ['GET', 'https://api.bible-strong.app/v1/naves/de/topics/aaron', { 'x-request-id': 'bad' }],
      // No publication: unavailable, with a delay to retry after.
      ['GET', 'https://api.bible-strong.app/v1/timelines/fr/events', { 'x-request-id': 'none' }],
      ['GET', 'https://api.bible-strong.app/v1/unknown-route', { 'x-request-id': 'unknown' }],
      ['OPTIONS', topicUrl, { origin: 'https://bible-strong.app' }],
      ['OPTIONS', topicUrl, { origin: 'https://elsewhere.example' }],
      ['HEAD', 'https://api.bible-strong.app/health', { 'x-request-id': 'health' }],
    ]

    for (const [method, url, headers] of requests) {
      const perRequest = makeResourceWebHandler(undefined, repository, {}, options)
      const expected = await perRequest.handler(new Request(url, { method, headers }))
      const actual = await shared.handler(
        new Request(url, { method, headers }),
        makeResourceRequestServices(undefined, repository)
      )

      assert.equal(actual.status, expected.status, `${method} ${url}`)
      assert.deepEqual([...actual.headers], [...expected.headers], `${method} ${url}`)
      assert.equal(await actual.text(), await expected.text(), `${method} ${url}`)
      await perRequest.dispose()
    }
    await shared.dispose()
  })

  it('builds the application once for an isolate', async () => {
    const application = resourceApplicationFor(['https://bible-strong.app'])

    const answers = await Promise.all([
      readResourceOrigin(
        originRead(new Request('https://api.bible-strong.app/health', { method: 'HEAD' }))
      ),
      readResourceOrigin(originRead(new Request('https://api.bible-strong.app/v1/unknown-route'))),
    ])

    assert.deepEqual(
      answers.map(answer => answer.status),
      [200, 404]
    )
    assert.equal(resourceApplicationFor(['https://bible-strong.app']), application)
  })

  it('opens no database for a search event and closes the one of a read', async () => {
    const event = resourceRequestServicesFor(
      originRead(new Request('https://api.bible-strong.app/v1/search-events', { method: 'POST' }))
    )
    const read = resourceRequestServicesFor(originRead(new Request(topicUrl)))
    const otherRead = resourceRequestServicesFor(originRead(new Request(topicUrl)))

    // Each request has its own repositories, over its own database handle.
    assert.notEqual(
      Context.get(read.services, BibleChapterRepository),
      Context.get(otherRead.services, BibleChapterRepository)
    )
    assert.notEqual(
      Context.get(read.services, NaveRepository),
      Context.get(event.services, NaveRepository)
    )
    await Promise.all([event.close(), read.close(), otherRead.close()])
  })

  it('times the first connection of a request and none of the later ones', async () => {
    const reported: number[] = []
    let connections = 0
    let ended = 0
    const client = { release: () => undefined } as unknown as Awaited<
      ReturnType<PostgresPool['connect']>
    >
    const pool = reportFirstConnection(
      {
        options: { max: 1 },
        connect: async () => {
          connections += 1
          return client
        },
        end: async () => {
          ended += 1
        },
      },
      durationMs => reported.push(durationMs)
    )

    assert.equal(await pool.connect(), client)
    assert.equal(await pool.connect(), client)
    await pool.end()

    assert.equal(connections, 2)
    assert.equal(reported.length, 1)
    assert.equal(reported[0] >= 0, true)
    assert.deepEqual(pool.options, { max: 1 })
    assert.equal(ended, 1)
  })
})

// A repository that a route needs must come with every request: leaving one out of the
// services of a request is a compile error, not an answer that fails in production.
const withoutNave = Context.make(BibleChapterRepository, {} as never)
// @ts-expect-error the Nave repository, among others, is missing
const incomplete: ResourceRequestServices = withoutNave
void incomplete
