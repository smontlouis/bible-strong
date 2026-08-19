import path from 'node:path'

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

  const roots = parsePublicationCatalogRoots(process.argv.slice(2))
  const mobileCatalogPath =
    process.env.RESOURCE_MOBILE_RESOURCE_CATALOG ??
    path.resolve(process.cwd(), 'src/assets/mobile-resource-catalog.json')
  const bundles = await findPublicationBundlesRecursively(roots)
  if (bundles.length === 0) throw new Error('RESOURCE_PUBLICATION_CATALOG_EMPTY')

  const results = await publishR2PublicationCatalog(
    bundles,
    mobileCatalogPath,
    new WranglerR2ArtifactStore({ bucket }),
    {
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
