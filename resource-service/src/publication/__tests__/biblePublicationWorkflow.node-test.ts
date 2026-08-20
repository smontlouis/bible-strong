import assert from 'node:assert/strict'
import path from 'node:path'
import { describe, it } from 'node:test'

import {
  createBiblePublicationPlan,
  executeBiblePublicationWorkflow,
  parseBiblePublicationWorkflowArgs,
  type BiblePublicationWorkflowOperations,
} from '../biblePublicationWorkflow'
import { mintResourceAppCheckToken, resourceApiRoute } from '../biblePublicationWorkflowCli'

describe('Bible publication workflow', () => {
  it('probes a covered chapter for a New-Testament-only Bible', () => {
    assert.equal(
      resourceApiRoute('bible:SBLGNT', { book: 40, chapter: 1 }),
      '/v1/bibles/SBLGNT/books/40/chapters/1'
    )
  })

  it('mints a short-lived App Check JWT from the protected debug credential', async () => {
    const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input.toString())
      assert.equal(url.hostname, 'firebaseappcheck.googleapis.com')
      assert.equal(url.searchParams.get('key'), 'public-api-key')
      assert.deepEqual(JSON.parse(String(init?.body)), { debugToken: 'registered-debug-token' })
      return new Response(JSON.stringify({ token: 'fresh-app-check-jwt', ttl: '3600s' }))
    }

    await assert.doesNotReject(async () => {
      const token = await mintResourceAppCheckToken(
        {
          NODE_ENV: 'test',
          RESOURCE_FIREBASE_PROJECT_ID: 'bible-strong-app',
          RESOURCE_FIREBASE_APP_ID: '1:123:ios:abc',
          RESOURCE_FIREBASE_API_KEY: 'public-api-key',
          RESOURCE_APP_CHECK_DEBUG_TOKEN: 'registered-debug-token',
        },
        fetcher
      )
      assert.equal(token, 'fresh-app-check-jwt')
    })
  })

  it('plans a complete candidate build without production writes by default', () => {
    const options = parseBiblePublicationWorkflowArgs([
      '--version',
      'lsg',
      '--source',
      '/editorial/bible-lsg.json',
      '--generated-at',
      '2026-08-19T21:00:00.000Z',
    ])

    assert.deepEqual(createBiblePublicationPlan(options), {
      versionId: 'LSG',
      sourcePath: '/editorial/bible-lsg.json',
      generatedAt: '2026-08-19T21:00:00.000Z',
      mode: 'preflight',
      productionWrites: false,
      steps: [
        'package-bible-publication',
        'resolve-dependent-publications',
        'generate-exhaustive-offline-catalog',
        'validate-publication-set',
        'validate-r2-publication',
      ],
    })
  })

  it('executes every preflight gate but no production operation by default', async () => {
    const calls: string[] = []
    const operation = (name: string) => async () => {
      calls.push(name)
    }
    const operations: BiblePublicationWorkflowOperations = {
      packageBiblePublication: operation('package'),
      resolveDependentPublications: operation('dependencies'),
      generateOfflineCatalog: operation('catalog'),
      validatePublicationSet: operation('publication-set'),
      validateR2Publication: operation('r2-preflight'),
      publishR2Artifacts: operation('r2-publish'),
      activateNeonPublications: operation('neon'),
      activateOfflineCatalog: operation('catalog-activate'),
      deployResourceWorker: operation('worker'),
      smokeProduction: operation('smoke'),
    }

    const result = await executeBiblePublicationWorkflow(
      parseBiblePublicationWorkflowArgs([
        '--version',
        'LSG',
        '--source',
        '/editorial/bible-lsg.json',
        '--generated-at',
        '2026-08-19T21:00:00.000Z',
      ]),
      operations
    )

    assert.deepEqual(calls, [
      'package',
      'dependencies',
      'catalog',
      'publication-set',
      'r2-preflight',
    ])
    assert.equal(result.mode, 'preflight')
    assert.equal(result.completedSteps.length, 5)
  })

  it('accepts repeated rebuilt dependent bundles and explicit workspace roots', () => {
    const options = parseBiblePublicationWorkflowArgs([
      '--version',
      'bhg',
      '--source',
      './bhg.json',
      '--dependent-bundle',
      './strong-bhg',
      '--dependent-bundle',
      './interlinear-bhg',
      '--maker-root',
      '../maker',
      '--publication-root',
      '../maker/outputs/resource-publications',
      '--workspace',
      './candidate',
      '--activate-production',
      '--confirm-production',
      'bible-strong.app',
    ])

    assert.equal(options.versionId, 'BHG')
    assert.equal(options.activateProduction, true)
    assert.deepEqual(options.dependentBundlePaths, [
      path.resolve('./strong-bhg'),
      path.resolve('./interlinear-bhg'),
    ])
    assert.equal(options.makerRoot, path.resolve('../maker'))
    assert.equal(options.publicationRoot, path.resolve('../maker/outputs/resource-publications'))
    assert.equal(options.workspacePath, path.resolve('./candidate'))
  })

  it('keeps the production mutations behind the explicit activation flag and ordered gates', () => {
    const plan = createBiblePublicationPlan(
      parseBiblePublicationWorkflowArgs([
        '--version',
        'LSG',
        '--source',
        '/editorial/bible-lsg.json',
        '--activate-production',
        '--confirm-production',
        'bible-strong.app',
      ])
    )

    assert.equal(plan.mode, 'production')
    assert.equal(plan.productionWrites, true)
    assert.deepEqual(plan.steps.slice(5), [
      'publish-r2-artifacts',
      'activate-neon-publications',
      'activate-offline-catalog',
      'deploy-resource-worker',
      'smoke-production',
    ])
  })

  it('requires an explicit production confirmation without depending on CI', () => {
    assert.throws(
      () =>
        parseBiblePublicationWorkflowArgs([
          '--version',
          'LSG',
          '--source',
          '/editorial/bible-lsg.json',
          '--activate-production',
        ]),
      /BIBLE_PUBLICATION_PRODUCTION_CONFIRMATION_REQUIRED/
    )
    assert.throws(
      () =>
        parseBiblePublicationWorkflowArgs([
          '--version',
          'LSG',
          '--source',
          '/editorial/bible-lsg.json',
          '--activate-production',
          '--confirm-production',
          'wrong-project',
        ]),
      /BIBLE_PUBLICATION_PRODUCTION_CONFIRMATION_REQUIRED/
    )
    assert.doesNotThrow(() =>
      parseBiblePublicationWorkflowArgs([
        '--version',
        'LSG',
        '--source',
        '/editorial/bible-lsg.json',
        '--activate-production',
        '--confirm-production',
        'bible-strong.app',
      ])
    )
  })
})
