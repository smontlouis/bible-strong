import assert from 'node:assert/strict'
import test from 'node:test'

import { pagePathOf, storageKeyOf } from './address'
import { readShareCardMeta, SHARE_CARD_META, shareCardUrl } from './content'

test('an image is asked for under the design and the path of its page', () => {
  assert.equal(shareCardUrl('/bible/lsg/john/3/16'), 'https://cards.bible-strong.app/v1/bible/lsg/john/3/16')
  assert.equal(shareCardUrl('/'), 'https://cards.bible-strong.app/v1')
  assert.equal(pagePathOf(new URL(shareCardUrl('/bible/lsg/john/3/16'))), '/bible/lsg/john/3/16')
  assert.equal(pagePathOf(new URL(shareCardUrl('/'))), '/')
  assert.equal(
    pagePathOf(new URL('https://cards.bible-strong.app/v1/strong/fr/g26/concordance?page=2')),
    '/strong/fr/g26/concordance?page=2'
  )
})

test('an address of another design, or of none, names no page', () => {
  assert.equal(pagePathOf(new URL('https://cards.bible-strong.app/v0/bible/lsg/john/3')), undefined)
  assert.equal(pagePathOf(new URL('https://cards.bible-strong.app/v10/bible')), undefined)
  assert.equal(pagePathOf(new URL('https://cards.bible-strong.app/favicon.ico')), undefined)
})

test('each page keeps its image under its own key, apart from other designs', () => {
  assert.equal(storageKeyOf('/bible/lsg/john/3/16'), 'share-cards/v1/bible/lsg/john/3/16')
  assert.equal(storageKeyOf('/'), 'share-cards/v1/index')
})

test('a page is read for what it says its image shows', () => {
  const content = { kind: 'text', kicker: 'Jean 3:16', chip: 'LSG', text: 'Il dit : "oui" & <non>.' }
  const written = JSON.stringify(content)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
  assert.deepEqual(
    readShareCardMeta(`<head><meta name="${SHARE_CARD_META}" content="${written}"/></head>`),
    content
  )
})

test('a page that says nothing readable gets the default card', () => {
  assert.equal(readShareCardMeta('<head><title>Page</title></head>'), undefined)
  assert.equal(
    readShareCardMeta(`<meta name="${SHARE_CARD_META}" content="{&quot;kind&quot;:&quot;poster&quot;}"/>`),
    undefined
  )
  assert.equal(readShareCardMeta(`<meta name="${SHARE_CARD_META}" content="not json"/>`), undefined)
})
