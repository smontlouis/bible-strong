import { parseArgs } from 'node:util'
import { makeLocalDatabase } from '../database/localDatabase'
import { backfillCommentaryChapterSections } from '../repositories/commentaryChapterSections'
import { formatPublicationCliFailure, resolveCatalogImportPolicy } from './publicationCliPolicy'

// Writes the chapter sections of active commentary publications imported before they were
// written at publication (ADR-0087), one publication per transaction. Without `--apply`, it
// counts what it would write.
async function main() {
  try {
    const { values } = parseArgs({
      options: {
        'resource-identity': { type: 'string', multiple: true },
        all: { type: 'boolean', default: false },
        mode: { type: 'string', default: 'local' },
        apply: { type: 'boolean', default: false },
      },
    })
    const named = values['resource-identity'] ?? []
    if (
      values.all === named.length > 0 ||
      !named.every(identity =>
        /^commentary:[A-Za-z0-9][A-Za-z0-9-]{1,63}:(?:fr|en)$/.test(identity)
      ) ||
      (values.mode !== 'local' && values.mode !== 'hosted')
    ) {
      throw new Error(
        'Usage: (--all | --resource-identity commentary:<id>:fr|en ...) [--mode local|hosted] [--apply]'
      )
    }
    const config = resolveCatalogImportPolicy({
      mode: values.mode,
      connectionString: process.env.RESOURCE_DATABASE_URL,
    })
    const database = makeLocalDatabase({ connectionString: config.connectionString })
    try {
      const identities = values.all
        ? (
            await database
              .selectFrom('resource_publications')
              .select('resource_identity')
              .where('resource_kind', '=', 'commentary')
              .where('status', '=', 'active')
              .orderBy('resource_identity')
              .execute()
          ).map(row => row.resource_identity)
        : named
      for (const resourceIdentity of identities) {
        const result = await backfillCommentaryChapterSections(database, {
          resourceIdentity,
          apply: values.apply,
        })
        process.stdout.write(`${JSON.stringify(result)}\n`)
      }
    } finally {
      await database.destroy()
    }
  } catch (error) {
    process.stderr.write(`${formatPublicationCliFailure(error)}\n`)
    process.exitCode = 1
  }
}
void main()
