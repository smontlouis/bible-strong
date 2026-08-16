import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'

import { validatePublicationBundle } from '../publication/publicationBundle'
import { createDevelopmentArtifact, respondWithDevelopmentArtifact } from './developmentArtifacts'

const main = async () => {
  const bundlePath = process.env.RESOURCE_PUBLICATION_BUNDLE
  if (!bundlePath) throw new Error('RESOURCE_PUBLICATION_BUNDLE_REQUIRED')

  const validated = await validatePublicationBundle(bundlePath)
  if (!validated.manifest.deliveryCapabilities.offlineDownload) {
    throw new Error('RESOURCE_OFFLINE_DELIVERY_NOT_DECLARED')
  }

  const artifact = createDevelopmentArtifact(
    validated.manifest,
    await readFile(validated.offlineArtifactPath)
  )
  const port = Number(process.env.RESOURCE_ARTIFACT_PORT ?? 8788)

  const server = createServer(async (request, response) => {
    try {
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
    console.log(`Development Resource artifact: http://127.0.0.1:${port}${artifact.route}`)
    console.log(`Android Emulator base URL: http://10.0.2.2:${port}`)
  })
}

void main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
