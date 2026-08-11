import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const catalogPath = path.resolve(
  projectRoot,
  process.argv[2] ?? 'src/assets/mobile-resource-catalog.json'
)
const outputPath = path.resolve(
  projectRoot,
  process.argv[3] ?? 'src/assets/offline-resource-size-manifest.json'
)

const catalog = JSON.parse(await readFile(catalogPath, 'utf8'))
if (
  catalog.format !== 'bible-strong-mobile-resource-catalog' ||
  catalog.schemaVersion !== 1 ||
  catalog.resourceCount !== Object.keys(catalog.resources ?? {}).length ||
  Object.values(catalog.resources ?? {}).some(resource => !resource.url.endsWith('.zip'))
) {
  throw new Error(`Invalid global mobile resource catalog: ${catalogPath}`)
}

const resources = Object.fromEntries(
  Object.entries(catalog.resources).map(([id, artifact]) => [
    id,
    {
      id,
      url: artifact.url,
      downloadBytes: artifact.archiveBytes,
      contentBytes: artifact.contentBytes,
      installedBytes: artifact.installedBytes,
      peakInstallationBytes: artifact.peakInstallationBytes,
      strategy: artifact.strategy,
      confidence: artifact.strategy === 'sqlite-import' ? 'estimated' : 'exact',
    },
  ])
)

await writeFile(
  outputPath,
  `${JSON.stringify(
    {
      schemaVersion: 1,
      generatedAt: catalog.generatedAt,
      resources,
    },
    null,
    2
  )}\n`
)

console.log(
  `Generated ${Object.keys(resources).length} entries in ${path.relative(projectRoot, outputPath)}`
)
