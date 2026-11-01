import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { Effect } from 'effect'
import { makeResourceWebHandler } from '../app'
import { makeKyselyStudyLinksRepository } from '../../repositories/studyLinksRepository'
import type { StudyLinksRepositoryService } from '../../domain/studyLinks'

const repository: StudyLinksRepositoryService = {
  findLinks: () =>
    Effect.succeed({
      revision: 'study-links-1',
      rows: [
        {
          kind: 'timeline',
          key: 'david-and-goliath',
          label_fr: 'David et Goliath',
          label_en: 'David and Goliath',
          detail_fr: '1024 BC',
          detail_en: '1024 BC',
          language: null,
          position: -1024,
          role: 'participant',
        },
        {
          kind: 'timeline',
          key: 'josiah-finds-law',
          label_fr: 'Josias trouve la loi',
          label_en: 'Josiah Finds Law',
          detail_fr: null,
          detail_en: null,
          language: null,
          position: -622,
          role: 'mentioned',
        },
        {
          kind: 'dictionary',
          key: 'isbe:1',
          label_fr: 'David',
          label_en: 'David',
          detail_fr: 'ISBE',
          detail_en: 'ISBE',
          language: 'en',
          position: null,
          role: null,
        },
      ],
    }),
}

const request = (path: string, overrides = { studyLinks: repository }) => {
  const web = makeResourceWebHandler(undefined, undefined, overrides)
  return web.handler(new Request(`http://resources.test${path}`)).finally(() => web.dispose())
}

describe('study links api', () => {
  it('answers from one subject in the language of the reader', async () => {
    const response = await request(
      `/v1/study-links/entity/${encodeURIComponent('David@Rut.4.17-Rev')}?language=fr`
    )
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      kind: 'entity',
      key: 'David@Rut.4.17-Rev',
      language: 'fr',
      revision: 'study-links-1',
      links: [
        {
          kind: 'timeline',
          key: 'david-and-goliath',
          label: 'David et Goliath',
          detail: '1024 BC',
          role: 'participant',
        },
      ],
    })
  })

  it('refuses an unknown kind', async () => {
    const response = await request('/v1/study-links/verse/1-1-1?language=fr')
    assert.equal(response.status, 400)
  })

  it('says the links are unavailable before their publication', async () => {
    const web = makeResourceWebHandler()
    const response = await web.handler(
      new Request('http://resources.test/v1/study-links/nave/love?language=fr')
    )
    await web.dispose()
    assert.equal(response.status, 503)
  })

  it('exposes a repository the worker can build', () => {
    assert.equal(typeof makeKyselyStudyLinksRepository, 'function')
  })
})
