import assert from 'node:assert/strict'
import test from 'node:test'

import { signedDescriptionOf, storageKeyOf } from './address'
import { shareCardUrl } from './content'

test('an image is asked for under the design and its signed description', () => {
  assert.equal(shareCardUrl('eyJraW5kIjoidGV4dCJ9.c2lnbmF0dXJl'), 'https://cards.bible-strong.app/v1/eyJraW5kIjoidGV4dCJ9.c2lnbmF0dXJl')
  assert.equal(shareCardUrl(), 'https://cards.bible-strong.app/v1')
  assert.equal(
    signedDescriptionOf(new URL(shareCardUrl('eyJraW5kIjoidGV4dCJ9.c2lnbmF0dXJl'))),
    'eyJraW5kIjoidGV4dCJ9.c2lnbmF0dXJl'
  )
  assert.equal(signedDescriptionOf(new URL(shareCardUrl())), '')
})

test('an address of another design, or of no description, asks for nothing', () => {
  for (const address of [
    'https://cards.bible-strong.app/v0/abc.def',
    'https://cards.bible-strong.app/v10/abc.def',
    'https://cards.bible-strong.app/favicon.ico',
    'https://cards.bible-strong.app/v1/bible/lsg/john/3',
    'https://cards.bible-strong.app/v1/abc',
    'https://cards.bible-strong.app/v1/abc.def.ghi',
    'https://cards.bible-strong.app/v1/..%2Fsecret.def',
  ]) {
    assert.equal(signedDescriptionOf(new URL(address)), undefined, address)
  }
})

test('each description keeps its image under its own key, apart from other designs', async () => {
  const first = await storageKeyOf('abc.def')
  assert.match(first, /^share-cards\/v1\/[0-9a-f]{64}$/u)
  assert.equal(await storageKeyOf('abc.def'), first)
  assert.notEqual(await storageKeyOf('abc.deg'), first)
  assert.equal(await storageKeyOf(''), 'share-cards/v1/default')
})
