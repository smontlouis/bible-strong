import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { Effect } from 'effect'

import type { TimelineRepositoryService } from '../../domain/timeline'
import { makeResourceWebHandler } from '../app'

const summary = {
  id: '1',
  slug: 'creation',
  title: 'Création',
  description: 'Le commencement',
  period: 'Origines',
  dates: '1',
  images: [],
}

describe('v1 Timeline API', () => {
  it('serves a lightweight index and pushes article search into the repository', async () => {
    let receivedOptions: { search?: string; limit?: number } | undefined
    const repository: TimelineRepositoryService = {
      listEvents: (language, options) => {
        receivedOptions = options
        return Effect.succeed({ language, revision: 'timeline-fr-r1', events: [summary] })
      },
      findEvent: input =>
        Effect.succeed({
          language: input.language,
          revision: 'timeline-fr-r1',
          event: {
            ...summary,
            article: 'Un long article',
            related: [],
            videos: [],
            scriptures: [],
          },
        }),
    }
    const web = makeResourceWebHandler(undefined, undefined, { timeline: repository })
    try {
      const response = await web.handler(
        new Request('http://localhost/v1/timelines/fr/events?search=commencement&limit=25')
      )
      assert.equal(response.status, 200)
      const body = (await response.json()) as { events: Record<string, unknown>[] }
      assert.equal(body.events.length, 1)
      assert.equal('article' in body.events[0], false)
      assert.deepEqual(receivedOptions, { search: 'commencement', limit: 25 })
    } finally {
      await web.dispose()
    }
  })
})
