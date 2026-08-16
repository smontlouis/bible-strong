import { Effect } from 'effect'

import { makeLocalDatabase } from '../database/localDatabase'
import { validatePublicationBundle } from './publicationBundle'
import { assembleBiblePublicationBundle } from './publicationBundleAssembler'
import { importPublicationBundle } from '../repositories/publicationImporter'

const parseOptions = (values: string[]) => {
  const options = new Map<string, string>()
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index]
    const value = values[index + 1]
    if (!key?.startsWith('--') || !value || value.startsWith('--')) {
      throw new Error(`PUBLICATION_CLI_ARGUMENT_INVALID:${key ?? '<missing>'}`)
    }
    if (options.has(key)) throw new Error(`PUBLICATION_CLI_ARGUMENT_DUPLICATE:${key}`)
    options.set(key, value)
  }
  return options
}

const required = (options: Map<string, string>, key: string) => {
  const value = options.get(key)
  if (!value) throw new Error(`PUBLICATION_CLI_ARGUMENT_REQUIRED:${key}`)
  return value
}

const booleanOption = (options: Map<string, string>, key: string, fallback = true) => {
  const value = options.get(key)
  if (value == null) return fallback
  if (value === 'true') return true
  if (value === 'false') return false
  throw new Error(`PUBLICATION_CLI_BOOLEAN_INVALID:${key}`)
}

const run = async () => {
  const [command, ...rawOptions] = process.argv.slice(2)
  const options = parseOptions(rawOptions)

  if (command === 'assemble') {
    const result = await assembleBiblePublicationBundle({
      artifactPath: required(options, '--artifact'),
      entry: required(options, '--entry'),
      outputPath: required(options, '--output'),
      language: required(options, '--language'),
      canon: required(options, '--canon'),
      versification: required(options, '--versification'),
      generatedAt: options.get('--generated-at'),
      rights: {
        holder: required(options, '--rights-holder'),
        termsReference: required(options, '--rights-terms'),
        attribution: required(options, '--attribution'),
        online: booleanOption(options, '--rights-online'),
        offline: booleanOption(options, '--rights-offline'),
      },
      deliveryCapabilities: {
        onlineAccess: booleanOption(options, '--online-access'),
        offlineDownload: booleanOption(options, '--offline-download'),
      },
    })
    console.log(JSON.stringify(result.manifest, null, 2))
    return
  }

  if (command === 'validate') {
    const result = await validatePublicationBundle(required(options, '--bundle'))
    console.log(JSON.stringify(result.manifest, null, 2))
    return
  }

  if (command === 'import') {
    const database = makeLocalDatabase({
      connectionString:
        process.env.RESOURCE_DATABASE_URL ??
        'postgresql://bible_strong:bible_strong@127.0.0.1:54329/bible_strong',
      maxConnections: 1,
    })
    try {
      const result = await Effect.runPromise(
        importPublicationBundle(required(options, '--bundle'), database)
      )
      console.log(JSON.stringify(result, null, 2))
    } finally {
      await database.destroy()
    }
    return
  }

  throw new Error(`PUBLICATION_CLI_COMMAND_INVALID:${command ?? '<missing>'}`)
}

run().catch(cause => {
  console.error(cause instanceof Error ? cause.message : cause)
  process.exitCode = 1
})
