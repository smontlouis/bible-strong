import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { resolveCatalogImportPolicy } from '../publicationCliPolicy'

describe('publication CLI policy', () => {
  it('keeps the local catalog bootstrap permissive for local-development publications', () => {
    assert.deepEqual(resolveCatalogImportPolicy({ mode: 'local' }), {
      connectionString: 'postgresql://bible_strong:bible_strong@127.0.0.1:54329/bible_strong',
      activateForLocalDevelopment: true,
    })
  })

  it('requires an explicit direct PostgreSQL connection for hosted imports', () => {
    assert.throws(
      () => resolveCatalogImportPolicy({ mode: 'hosted' }),
      /PUBLICATION_HOSTED_DATABASE_URL_REQUIRED/
    )
    assert.throws(
      () =>
        resolveCatalogImportPolicy({
          mode: 'hosted',
          connectionString:
            'postgresql://owner:secret@ep-example-pooler.eu-central-1.aws.neon.tech/neondb',
        }),
      /PUBLICATION_HOSTED_DATABASE_URL_MUST_BE_DIRECT/
    )
  })

  it('never activates local-development-only publications during a hosted import', () => {
    const connectionString =
      'postgresql://owner:secret@ep-example.eu-central-1.aws.neon.tech/neondb'

    assert.deepEqual(resolveCatalogImportPolicy({ mode: 'hosted', connectionString }), {
      connectionString,
      activateForLocalDevelopment: false,
    })
  })
})
