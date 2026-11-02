#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { findMissingDomAssets } from './lib/updateDomPages.mjs'

const dist = path.resolve(process.argv[2] ?? 'dist')
const { fileMetadata } = JSON.parse(readFileSync(path.join(dist, 'metadata.json'), 'utf8'))
const domDirectory = path.join(dist, 'www.bundle')

let failed = false
for (const [platform, { assets, bundle }] of Object.entries(fileMetadata)) {
  const missing = findMissingDomAssets({
    assets,
    bundle: readFileSync(path.join(dist, bundle)),
    readPage: page => readFileSync(path.join(domDirectory, page), 'utf8'),
  })

  if (missing.length === 0) {
    console.log(`${platform}: every DOM page and its files are in the update`)
    continue
  }

  failed = true
  console.error(`${platform}: missing from the update metadata: ${missing.join(', ')}`)
}

if (failed) {
  console.error('Refusing this export: export again before publishing.')
  process.exit(1)
}
