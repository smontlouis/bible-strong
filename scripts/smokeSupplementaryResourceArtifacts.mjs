const baseUrl = process.env.RESOURCE_ARTIFACT_BASE_URL ?? 'http://127.0.0.1:8789'
const artifacts = [
  ['/databases/commentaires-mhy.sqlite.zip', process.env.MHY_BUNDLE],
  ['/databases/commentaires-tresor.sqlite.zip', process.env.TRESOR_BUNDLE],
]

for (const [path, bundle] of artifacts) {
  const manifest = JSON.parse(await readFile(`${bundle}/manifest.json`, 'utf8'))
  const response = await fetch(`${baseUrl}${path}`, { method: 'HEAD' })
  if (response.status !== 200)
    throw new Error(`supplementary-artifact-http:${path}:${response.status}`)
  if (Number(response.headers.get('content-length')) !== manifest.offlineArtifact.bytes) {
    throw new Error(`supplementary-artifact-size:${path}`)
  }
}

console.log('supplementary-resource-artifacts-smoke:ok')
import { readFile } from 'node:fs/promises'
