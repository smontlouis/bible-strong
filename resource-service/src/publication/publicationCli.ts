import { Effect } from 'effect'

import { makeLocalDatabase } from '../database/localDatabase'
import { validatePublicationBundle } from './publicationBundle'
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

const run = async () => {
  const [command, ...rawOptions] = process.argv.slice(2)
  const options = parseOptions(rawOptions)

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
