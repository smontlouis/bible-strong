import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const baseUrl = process.env.RESOURCE_ARTIFACT_BASE_URL ?? 'http://127.0.0.1:8788'
const readArchiveBytes = async (bundle, fallback) => {
  if (!bundle) return fallback
  const manifest = JSON.parse(await readFile(`${bundle}/manifest.json`, 'utf8'))
  return manifest.offlineArtifact.bytes
}

const artifacts = [
  {
    path: '/databases/nave-fr.sqlite.zip',
    bytes: await readArchiveBytes(process.env.NAVE_FR_BUNDLE, 2068972),
  },
  {
    path: '/databases/en/nave.sqlite.zip',
    bytes: await readArchiveBytes(process.env.NAVE_EN_BUNDLE, 2010815),
  },
]

for (const artifact of artifacts) {
  const response = await fetch(`${baseUrl}${artifact.path}`, { method: 'HEAD' })
  assert.equal(response.status, 200, artifact.path)
  assert.equal(Number(response.headers.get('content-length')), artifact.bytes)
  assert.ok(response.headers.get('etag'))
}

console.log('nave-resource-artifacts-smoke:ok')
