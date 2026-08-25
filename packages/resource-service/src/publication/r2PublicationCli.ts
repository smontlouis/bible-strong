import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  findPublicationBundlesRecursively,
  parsePublicationCatalogRoots,
} from './publicationCatalog'
import { formatPublicationCliFailure } from './publicationCliPolicy'
import { publishR2PublicationCatalog } from './r2ArtifactPublisher'
import { WranglerR2ArtifactStore } from './wranglerR2ArtifactStore'

const run = async () => {
  const bucket = process.env.RESOURCE_R2_BUCKET?.trim()
  if (!bucket) throw new Error('RESOURCE_R2_BUCKET_REQUIRED')

  const rawOptions = process.argv.slice(2)
  const changedFlags = rawOptions.filter(option => option === '--changed')
  if (changedFlags.length > 1) throw new Error('R2_PUBLICATION_CHANGED_FLAG_DUPLICATE')
  const bundleSelection = changedFlags.length === 1 ? ('changed' as const) : ('exhaustive' as const)
  const roots = parsePublicationCatalogRoots(rawOptions.filter(option => option !== '--changed'))
  const mobileCatalogPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../../resource-catalog/src/mobile-resource-catalog.json'
  )
  const bundles = await findPublicationBundlesRecursively(roots)
  if (bundles.length === 0) throw new Error('RESOURCE_PUBLICATION_CATALOG_EMPTY')

  const results = await publishR2PublicationCatalog(
    bundles,
    mobileCatalogPath,
    new WranglerR2ArtifactStore({ bucket }),
    {
      expectedCatalogResourceCount: 72,
      bundleSelection,
      onResult: (result, index, total) => {
        const detail = result.status === 'skipped' ? result.reason : result.key
        console.error(
          `[${index}/${total}] ${result.status}: ${result.resourceIdentity} (${detail})`
        )
      },
    }
  )
  console.log(
    JSON.stringify(
      {
        bucket,
        bundleSelection,
        bundleCount: bundles.length,
        uploaded: results.filter(result => result.status === 'uploaded').length,
        unchanged: results.filter(result => result.status === 'unchanged').length,
        skipped: results.filter(result => result.status === 'skipped').length,
        results,
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
