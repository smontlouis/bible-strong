import { Effect } from 'effect'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import { makeLocalDatabase } from '../database/localDatabase'
import { validatePublicationBundle } from './publicationBundle'
import { formatPublicationCliFailure, resolveCatalogImportPolicy } from './publicationCliPolicy'
import {
  findPublicationBundlesRecursively,
  parsePublicationCatalogRoots,
} from './publicationCatalog'
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

export const findPublicationBundles = async (rootPath: string) => {
  const root = path.resolve(rootPath)
  const entries = await readdir(root, { withFileTypes: true })
  return entries
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(root, entry.name))
    .sort((left, right) => left.localeCompare(right))
}

const publicationPriority = async (bundle: string) => {
  const manifest = JSON.parse(await readFile(path.join(bundle, 'manifest.json'), 'utf8')) as {
    identity?: { kind?: string; moduleId?: string }
  }
  const kind = manifest.identity?.kind
  if (kind === 'bible-text') return 0
  if (kind === 'strong-lexicon-module') {
    return manifest.identity?.moduleId === 'core' ? 1 : 2
  }
  if (kind === 'strong-bible-index') return 3
  if (kind === 'interlinear-index') return 4
  return 2
}

const run = async () => {
  const [command, ...rawOptions] = process.argv.slice(2)
  const options =
    command === 'import-catalog' || command === 'import-catalog-hosted'
      ? new Map<string, string>()
      : parseOptions(rawOptions)

  if (command === 'validate') {
    const result = await validatePublicationBundle(required(options, '--bundle'))
    console.log(JSON.stringify(result.manifest, null, 2))
    return
  }

  if (command === 'import' || command === 'import-all') {
    const database = makeLocalDatabase({
      connectionString:
        process.env.RESOURCE_DATABASE_URL ??
        'postgresql://bible_strong:bible_strong@127.0.0.1:54329/bible_strong',
      maxConnections: 1,
    })
    try {
      if (command === 'import') {
        const result = await Effect.runPromise(
          importPublicationBundle(required(options, '--bundle'), database)
        )
        console.log(JSON.stringify(result, null, 2))
      } else {
        const bundles = await findPublicationBundles(required(options, '--root'))
        const results = []
        for (const bundle of bundles) {
          results.push(
            await Effect.runPromise(
              importPublicationBundle(bundle, database, {
                activateForLocalDevelopment: true,
              })
            )
          )
        }
        console.log(JSON.stringify(results, null, 2))
      }
    } finally {
      await database.destroy()
    }
    return
  }

  if (command === 'import-catalog' || command === 'import-catalog-hosted') {
    const policy = resolveCatalogImportPolicy({
      mode: command === 'import-catalog-hosted' ? 'hosted' : 'local',
      connectionString: process.env.RESOURCE_DATABASE_URL,
    })
    const database = makeLocalDatabase({
      connectionString: policy.connectionString,
      maxConnections: 1,
    })
    try {
      const bundles = await findPublicationBundlesRecursively(
        parsePublicationCatalogRoots(rawOptions)
      )
      const orderedBundles = (
        await Promise.all(
          bundles.map(async bundle => ({ bundle, priority: await publicationPriority(bundle) }))
        )
      )
        .sort(
          (left, right) => left.priority - right.priority || left.bundle.localeCompare(right.bundle)
        )
        .map(item => item.bundle)
      const results = []
      for (const bundle of orderedBundles) {
        try {
          results.push(
            await Effect.runPromise(
              importPublicationBundle(bundle, database, {
                activateForLocalDevelopment: policy.activateForLocalDevelopment,
              })
            )
          )
        } catch (cause) {
          throw new Error(`PUBLICATION_CATALOG_IMPORT_FAILED:${bundle}`, { cause })
        }
      }
      console.log(JSON.stringify({ bundleCount: orderedBundles.length, results }, null, 2))
    } finally {
      await database.destroy()
    }
    return
  }

  throw new Error(`PUBLICATION_CLI_COMMAND_INVALID:${command ?? '<missing>'}`)
}

run().catch(cause => {
  console.error(formatPublicationCliFailure(cause))
  process.exitCode = 1
})
