import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const baseUrl = process.env.RESOURCE_ARTIFACT_BASE_URL ?? 'http://127.0.0.1:8789'
const artifacts = [
  ['/databases/bible-timeline-events.json.zip', process.env.TIMELINE_FR_BUNDLE],
  ['/databases/en/bible-timeline-events.json.zip', process.env.TIMELINE_EN_BUNDLE],
]

for (const [path, bundle] of artifacts) {
  assert.ok(bundle, `missing bundle path for ${path}`)
  const manifest = JSON.parse(await readFile(`${bundle}/manifest.json`, 'utf8'))
  const response = await fetch(`${baseUrl}${path}`, { method: 'HEAD' })
  assert.equal(response.status, 200)
  assert.equal(Number(response.headers.get('content-length')), manifest.offlineArtifact.bytes)
}

console.log('timeline-resource-artifacts-smoke:ok')
