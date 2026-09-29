import { readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  ARCHIVE_KEYS_ENV,
  type EncryptableCatalogEntry,
  ensureEncryptedOfflineArchive,
  type EnsureEncryptedArchiveResult,
  latestArchiveKeyVersion,
  parseArchiveKeys,
} from './encryptedOfflineArchive'
import { formatPublicationCliFailure } from './publicationCliPolicy'
import { WranglerR2ArtifactStore } from './wranglerR2ArtifactStore'

type CatalogJson = {
  resources: Record<string, EncryptableCatalogEntry & Record<string, unknown>>
} & Record<string, unknown>

const defaultCatalogPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../resource-catalog/src/mobile-resource-catalog.json'
)

const parseOptions = (args: readonly string[]) => {
  const resourceIds: string[] = []
  let dryRun = false
  let catalogPath = defaultCatalogPath
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--dry-run') dryRun = true
    else if (arg === '--resource' && args[index + 1]) resourceIds.push(args[++index]!)
    else if (arg === '--catalog' && args[index + 1]) catalogPath = path.resolve(args[++index]!)
    else throw new Error(`ENCRYPTED_ARCHIVE_CLI_OPTION_INVALID:${arg}`)
  }
  return { resourceIds, dryRun, catalogPath }
}

const run = async () => {
  const bucket = process.env.RESOURCE_R2_BUCKET?.trim()
  if (!bucket) throw new Error('RESOURCE_R2_BUCKET_REQUIRED')
  const keys = parseArchiveKeys(process.env[ARCHIVE_KEYS_ENV])
  const keyVersion = latestArchiveKeyVersion(keys)
  const apiOrigin = process.env.RESOURCE_API_ORIGIN?.trim() || 'https://api.bible-strong.app'
  const { resourceIds, dryRun, catalogPath } = parseOptions(process.argv.slice(2))

  const catalog = JSON.parse(await readFile(catalogPath, 'utf8')) as CatalogJson
  const selectedIds = resourceIds.length > 0 ? resourceIds : Object.keys(catalog.resources)
  const unknownIds = selectedIds.filter(id => !catalog.resources[id])
  if (unknownIds.length > 0) throw new Error(`ENCRYPTED_ARCHIVE_RESOURCE_UNKNOWN:${unknownIds}`)

  const store = new WranglerR2ArtifactStore({ bucket })
  const results: Array<{ id: string } & EnsureEncryptedArchiveResult> = []
  for (const [index, id] of selectedIds.entries()) {
    const result = await ensureEncryptedOfflineArchive({
      entry: catalog.resources[id]!,
      store,
      keys,
      keyVersion,
      apiOrigin,
      dryRun,
    })
    results.push({ id, ...result })
    console.error(`[${index + 1}/${selectedIds.length}] ${result.status}: ${id}`)
  }

  if (!dryRun) {
    for (const { id, descriptor } of results) catalog.resources[id]!.encryptedArchive = descriptor
    // generatedAt is kept: clients reject a remote catalog older than their bundled one.
    const temporaryPath = `${catalogPath}.tmp`
    await writeFile(temporaryPath, `${JSON.stringify(catalog, null, 2)}\n`)
    await rename(temporaryPath, catalogPath)
  }

  console.log(
    JSON.stringify(
      {
        bucket,
        keyVersion,
        dryRun,
        catalogPath,
        resourceCount: results.length,
        encrypted: results.filter(result => result.status === 'encrypted').length,
        indexed: results.filter(result => result.status === 'indexed').length,
        verifiedOnly: results.filter(result => result.status === 'verified-only').length,
        encryptedBytes: results.reduce((total, result) => total + result.descriptor.bytes, 0),
      },
      null,
      2
    )
  )
}

run().catch(cause => {
  console.error(formatPublicationCliFailure(cause))
  process.exitCode = 1
})
