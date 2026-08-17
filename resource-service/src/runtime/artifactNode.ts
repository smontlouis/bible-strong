import { readFile, readdir } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'

import { validatePublicationBundle } from '../publication/publicationBundle'
import {
  createDevelopmentArtifact,
  respondWithDevelopmentArtifact,
  type DevelopmentArtifact,
} from './developmentArtifacts'

const main = async () => {
  const bundlePaths = process.env.RESOURCE_PUBLICATION_BUNDLES_ROOT
    ? (await readdir(process.env.RESOURCE_PUBLICATION_BUNDLES_ROOT, { withFileTypes: true }))
        .filter(entry => entry.isDirectory())
        .map(entry => path.join(process.env.RESOURCE_PUBLICATION_BUNDLES_ROOT!, entry.name))
        .sort()
    : process.env.RESOURCE_PUBLICATION_BUNDLE
      ? [process.env.RESOURCE_PUBLICATION_BUNDLE]
      : []
  if (!bundlePaths.length) throw new Error('RESOURCE_PUBLICATION_BUNDLE_REQUIRED')
  const artifacts: DevelopmentArtifact[] = []
  for (const bundlePath of bundlePaths) {
    const validated = await validatePublicationBundle(bundlePath)
    if (!validated.manifest.deliveryCapabilities.offlineDownload) {
      throw new Error('RESOURCE_OFFLINE_DELIVERY_NOT_DECLARED')
    }
    artifacts.push(
      createDevelopmentArtifact(validated.manifest, await readFile(validated.offlineArtifactPath))
    )
  }
  const port = Number(process.env.RESOURCE_ARTIFACT_PORT ?? 8788)

  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(
        `http://${request.headers.host ?? `127.0.0.1:${port}`}${request.url}`
      ).pathname
      const artifact = artifacts.find(candidate => candidate.route === pathname)
      if (!artifact) {
        response.writeHead(404)
        response.end()
        return
      }
      const result = respondWithDevelopmentArtifact(
        new Request(`http://${request.headers.host ?? `127.0.0.1:${port}`}${request.url}`, {
          method: request.method,
        }),
        artifact
      )
      response.writeHead(result.status, Object.fromEntries(result.headers.entries()))
      response.end(result.body ? Buffer.from(await result.arrayBuffer()) : undefined)
    } catch (error) {
      console.error(error)
      response.writeHead(500)
      response.end()
    }
  })

  server.listen(port, '0.0.0.0', () => {
    for (const artifact of artifacts) {
      console.log(`Development Resource artifact: http://127.0.0.1:${port}${artifact.route}`)
    }
    console.log(`Android Emulator base URL: http://10.0.2.2:${port}`)
  })
}

void main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
