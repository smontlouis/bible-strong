import assert from 'node:assert/strict'
import test from 'node:test'
import { findMissingDomAssets } from '../lib/updateDomPages.mjs'

const editorPage = `${'a'.repeat(32)}.html`
const editorScript = `${'b'.repeat(32)}.js`
const asset = name => ({ path: `www.bundle/${name}`, ext: name.split('.').pop() })

const check = assets =>
  findMissingDomAssets({
    assets: assets.map(asset),
    bundle: Buffer.from(`\0filePath\0${editorPage}\0`),
    readPage: () => `<script src="./${editorScript}" defer></script>`,
  })

test('accepts an update listing the page and what it loads', () => {
  assert.deepEqual(check([editorPage, editorScript]), [])
})

test('finds a page the bundle opens and the update does not list', () => {
  assert.deepEqual(check([editorScript]), [editorPage])
})

test('finds a file a listed page loads and the update does not list', () => {
  assert.deepEqual(check([editorPage]), [editorScript])
})
