import { parseArgs } from 'node:util'
import { makeLocalDatabase } from '../database/localDatabase'
import { backfillCommentaryReadingIndex } from '../repositories/commentaryReadingBackfill'
import { formatPublicationCliFailure, resolveCatalogImportPolicy } from './publicationCliPolicy'

async function main() {
  try {
    const { values } = parseArgs({
      options: {
        'resource-id': { type: 'string' },
        language: { type: 'string' },
        mode: { type: 'string', default: 'local' },
        apply: { type: 'boolean', default: false },
      },
    })
    const resourceId = values['resource-id']
    if (
      !resourceId ||
      !/^[A-Za-z0-9][A-Za-z0-9-]{1,63}$/.test(resourceId) ||
      (values.language !== 'fr' && values.language !== 'en') ||
      (values.mode !== 'local' && values.mode !== 'hosted')
    ) {
      throw new Error(
        'Usage: --resource-id <publication-id> --language fr|en [--mode local|hosted] [--apply]'
      )
    }
    const config = resolveCatalogImportPolicy({
      mode: values.mode,
      connectionString: process.env.RESOURCE_DATABASE_URL,
    })
    const database = makeLocalDatabase({ connectionString: config.connectionString })
    try {
      const result = await backfillCommentaryReadingIndex(database, {
        resourceId,
        language: values.language,
        apply: values.apply,
      })
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    } finally {
      await database.destroy()
    }
  } catch (error) {
    process.stderr.write(`${formatPublicationCliFailure(error)}\n`)
    process.exitCode = 1
  }
}
void main()
