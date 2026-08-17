import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { Effect } from 'effect'

import {
  ActiveStrongLexiconPublicationUnavailable,
  StrongLexiconEntityNotFound,
  StrongLexiconEntryNotFound,
  type StrongLexiconRepositoryService,
} from '../../domain/strongLexicon'
import { makeResourceWebHandler } from '../app'

const revision = 'strong-lexicon-core-test'
const searchEntry = {
  id: 3056,
  stepCode: 'G3056',
  classicStrong: 'G3056',
  language: 'greek' as const,
  original: 'λόγος',
  transliteration: 'logos',
  gloss: 'parole',
}
const entity = {
  id: 1,
  uniqueName: 'Adam@Gen.2.19-Jud',
  strongCodes: ['H0120'],
  name: 'Adam',
  category: 'person',
  type: 'Male',
  description: 'Premier homme',
  shortDescription: 'Premier homme',
  summaryHtml: '<p>Adam</p>',
  brief: 'Adam',
  articleHtml: '<p>Adam</p>',
  relations: [],
}

const repository: StrongLexiconRepositoryService = {
  getModuleState: moduleId =>
    Effect.succeed({ moduleId, status: 'available', revision: `${moduleId}-r1` }),
  findEntry: input =>
    input.reference === 'absent'
      ? Effect.fail(new StrongLexiconEntryNotFound(input))
      : Effect.succeed({
          revision,
          value: {
            ...searchEntry,
            selectedIdentity: { kind: 'strong', code: 'G3056' },
            eStrong: 'G3056',
            dStrong: 'G3056 =',
            baseCode: 3056,
            pronunciation: 'log-os',
            definitionHtml: '<p>parole</p>',
            morphology: { code: 'G:N-M', meaning: 'nom grec' },
            relations: [],
            resources: [],
            lsjAbsent: false,
            entity,
            modules: {
              resources: {
                status: 'available',
                moduleId: 'resources',
                revision: 'resources-r1',
                schemaVersion: 2,
              },
              entities: {
                status: 'available',
                moduleId: 'entities',
                revision: 'entities-r1',
                schemaVersion: 2,
              },
            },
          },
        }),
  listEntries: () => Effect.succeed({ revision, value: [searchEntry] }),
  findRandom: () => Effect.succeed({ revision, value: [searchEntry] }),
  findMorphologies: input =>
    Effect.succeed({ revision, value: input.codes.map(code => ({ code, meaning: 'nom grec' })) }),
  findEntity: input =>
    input.uniqueName === 'absent'
      ? Effect.fail(new StrongLexiconEntityNotFound(input))
      : Effect.succeed({ revision: 'entities-r1', value: entity }),
  findChapterEntities: () =>
    Effect.succeed({
      revision: 'entities-r1',
      value: [
        {
          uniqueName: entity.uniqueName,
          name: entity.name,
          category: 'person',
          type: entity.type,
          verses: [1],
        },
      ],
    }),
}

const request = (path: string) =>
  new Request(`http://localhost${path}`, {
    headers: { 'x-request-id': 'strong-lexicon-request-123' },
  })

describe('v1 Strong lexicon API', () => {
  it('serves module, entry, browse, random, morphology, entity, and chapter contracts', async () => {
    const web = makeResourceWebHandler(undefined, undefined, { strongLexicon: repository })
    try {
      const paths = [
        '/v1/strong-lexicon/modules/core',
        '/v1/strong-lexicon/entries/G3056?language=fr',
        '/v1/strong-lexicon/entries?language=fr&search=parole&limit=10',
        '/v1/strong-lexicon/random?language=fr&lexicalLanguage=greek',
        '/v1/strong-lexicon/morphologies?language=fr&codes=G%3AN-M',
        '/v1/strong-lexicon/entities/Adam%40Gen.2.19-Jud?language=fr',
        '/v1/strong-lexicon/entities/chapters/Gen/1?language=fr',
      ]
      for (const path of paths) {
        const response = await web.handler(request(path))
        assert.equal(response.status, 200, `${path}: ${await response.clone().text()}`)
        assert.equal(response.headers.get('x-request-id'), 'strong-lexicon-request-123')
      }
    } finally {
      await web.dispose()
    }
  })

  it('keeps missing and unavailable modules distinct', async () => {
    const unavailable: StrongLexiconRepositoryService = {
      ...repository,
      findEntry: () =>
        Effect.fail(new ActiveStrongLexiconPublicationUnavailable({ moduleId: 'core' })),
    }
    const web = makeResourceWebHandler(undefined, undefined, { strongLexicon: unavailable })
    try {
      const missing = await web.handler(request('/v1/strong-lexicon/entities/absent?language=fr'))
      assert.equal(missing.status, 404)
      assert.equal(
        ((await missing.json()) as { code: string }).code,
        'STRONG_LEXICON_ENTITY_NOT_FOUND'
      )

      const inactive = await web.handler(request('/v1/strong-lexicon/entries/G3056?language=fr'))
      assert.equal(inactive.status, 503)
      assert.equal(
        ((await inactive.json()) as { code: string }).code,
        'STRONG_LEXICON_PUBLICATION_INACTIVE'
      )
    } finally {
      await web.dispose()
    }
  })
})
