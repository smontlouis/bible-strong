// Puts the daily readings and scenes in the public media bucket, immutable copies first, catalog last.
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import {
  CATALOG_CACHE_CONTROL, pendingUploads, putImmutableCopies, unreachableAddresses, wranglerPut, type MediaUpload,
} from '../../../src/mediaUpload'

const BUCKET = 'bible-strong-media-prod'
const HOST = 'https://media.bible-strong.app/'
const BUILD = new URL('../../../outputs/daily-readings/build/', import.meta.url).pathname
const LEDGER = path.join(BUILD, 'upload-ledger.json')
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap(name => {
    const full = path.join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
const upload = (file: string): MediaUpload => {
  const key = path.relative(BUILD, file)
  return { key, file, sha256: createHash('sha256').update(readFileSync(file)).digest('hex'), url: HOST + key }
}
const dryRun = process.argv.includes('--dry-run')
const scenes = walk(path.join(BUILD, 'daily-scenes')).filter(f => f.endsWith('.webp')).map(upload)
const readings = walk(path.join(BUILD, 'daily-readings')).filter(f => f.endsWith('.json') && !f.endsWith('catalog.json')).map(upload)
const pendingScenes = await pendingUploads(scenes, LEDGER)
const pendingReadings = await pendingUploads(readings, LEDGER)
console.log(`scenes ${scenes.length} (${pendingScenes.length} to put), readings ${readings.length} (${pendingReadings.length} to put)`)
if (dryRun) process.exit(0)
await putImmutableCopies(BUCKET, pendingScenes, LEDGER, 'image/webp')
await putImmutableCopies(BUCKET, pendingReadings, LEDGER, 'application/json; charset=utf-8')
const unreachable = await unreachableAddresses([...scenes, ...readings].map(u => u.url))
if (unreachable.length) {
  console.error('unreachable, catalog not put:', unreachable.slice(0, 10))
  process.exit(1)
}
await wranglerPut(BUCKET, 'daily-readings/catalog.json', path.join(BUILD, 'daily-readings/catalog.json'), 'application/json; charset=utf-8', CATALOG_CACHE_CONTROL)
console.log('catalog put:', HOST + 'daily-readings/catalog.json')
