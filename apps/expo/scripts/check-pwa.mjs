// Validates the PWA files of an Expo Web export (ADR-0067). Run after web:export / web:build.
import assert from 'node:assert/strict'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const MiB = 1024 * 1024
const PRECACHE_BUDGET = 30 * MiB
const read = path => readFileSync(join(dist, path), 'utf8')
const pngSize = path => {
  const png = readFileSync(join(dist, path))
  assert.equal(png.toString('ascii', 1, 4), 'PNG', `${path} is not a PNG`)
  return `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`
}

assert(existsSync(join(dist, 'index.html')), 'Export Expo Web before checking the PWA')

// Manifest and icons
const manifest = JSON.parse(read('manifest.webmanifest'))
for (const field of ['id', 'name', 'short_name', 'start_url', 'scope', 'theme_color']) {
  assert(manifest[field], `manifest.webmanifest is missing "${field}"`)
}
assert.equal(manifest.display, 'standalone', 'manifest display must be standalone')
for (const purpose of ['any', 'maskable']) {
  for (const size of ['192x192', '512x512']) {
    const icon = manifest.icons.find(i => i.purpose === purpose && i.sizes === size)
    assert(icon, `manifest needs a ${size} "${purpose}" icon`)
    assert.equal(pngSize(icon.src.replace(/^\//, '')), size, `${icon.src} is not ${size}`)
  }
}

// HTML template
const html = read('index.html')
for (const [label, pattern] of [
  ['lang', /<html lang="en">/],
  ['viewport-fit=cover', /name="viewport"[^>]*viewport-fit=cover/],
  ['manifest link', /<link rel="manifest" href="\/manifest\.webmanifest"/],
  ['theme-color', /<meta name="theme-color"/],
  ['apple-touch-icon', /<link rel="apple-touch-icon" href="\/icons\/apple-touch-icon\.png"/],
  ['Smart App Banner', /<meta name="apple-itunes-app" content="app-id=1454738221"/],
]) {
  assert.match(html, pattern, `index.html is missing ${label}`)
}
assert.equal(pngSize('icons/apple-touch-icon.png'), '180x180', 'apple-touch-icon must be 180x180')

// Cloudflare headers
const headers = read('_headers')
assert.match(headers, /\/sw\.js\s+Cache-Control: no-cache/, '_headers must revalidate /sw.js')
assert.match(
  headers,
  /Content-Type: application\/manifest\+json/,
  '_headers must type the manifest'
)

// Service worker precache
const sw = read('sw.js')
const entries = [...sw.matchAll(/"url":"([^"]+)"/g)].map(match => match[1])
assert(entries.length > 0, 'sw.js has no precache manifest')
let bytes = 0
for (const url of entries) {
  assert(
    !/^[a-z]+:/i.test(url) && !url.startsWith('//'),
    `precache entry is not same-origin: ${url}`
  )
  const file = join(dist, decodeURIComponent(url))
  assert(existsSync(file), `precache entry is missing from dist: ${url}`)
  bytes += statSync(file).size
}
for (const required of ['index.html', 'manifest.webmanifest']) {
  assert(entries.includes(required), `precache must include ${required}`)
}
assert(
  entries.some(url => /^_expo\/static\/js\/web\/entry-[0-9a-f]+\.js$/.test(url)),
  'precache must include the web entry bundle'
)
assert(
  bytes <= PRECACHE_BUDGET,
  `precache is ${(bytes / MiB).toFixed(2)} MiB, over the ${PRECACHE_BUDGET / MiB} MiB budget`
)

console.log(
  `PWA files are valid; precache: ${entries.length} files, ${(bytes / MiB).toFixed(2)} MiB`
)
