import assert from 'node:assert/strict'
import { readdir, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const directory = fileURLToPath(new URL('../dist/', import.meta.url))
const limit = 25 * 1024 * 1024
const files = await readdir(directory, { recursive: true, withFileTypes: true })
const assets = await Promise.all(
  files
    .filter(file => file.isFile())
    .map(async file => {
      const path = join(file.parentPath, file.name)
      return { path, size: (await stat(path)).size }
    })
)
assert(assets.length > 0, 'Export Expo Web before checking its assets')
const oversized = assets.filter(asset => asset.size > limit)
assert.equal(
  oversized.length,
  0,
  `Cloudflare assets exceed 25 MiB:\n${oversized.map(asset => `${asset.path}: ${asset.size} bytes`).join('\n')}`
)
const largest = assets.reduce((largest, asset) => (asset.size > largest.size ? asset : largest))
console.log(
  `Web assets fit Cloudflare limits; largest: ${(largest.size / 1024 / 1024).toFixed(2)} MiB`
)
