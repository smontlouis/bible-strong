import assert from 'node:assert/strict'
import test from 'node:test'
import { embeddedUpdateEntries } from '../lib/storeBuildArchive.mjs'

test('finds the embedded update in an Android App Bundle', () => {
  assert.deepEqual(
    embeddedUpdateEntries('bible-strong.aab', [
      'base/manifest/AndroidManifest.xml',
      'base/assets/app.manifest',
      'base/assets/index.android.bundle',
    ]),
    {
      platform: 'android',
      manifest: 'base/assets/app.manifest',
      bundle: 'base/assets/index.android.bundle',
    }
  )
})

test('finds the embedded update in an iOS archive, whatever the app is called', () => {
  assert.deepEqual(
    embeddedUpdateEntries('build-1.ipa', [
      'Payload/BibleStrong.app/Info.plist',
      'Payload/BibleStrong.app/EXUpdates.bundle/app.manifest',
      'Payload/BibleStrong.app/main.jsbundle',
    ]),
    {
      platform: 'ios',
      manifest: 'Payload/BibleStrong.app/EXUpdates.bundle/app.manifest',
      bundle: 'Payload/BibleStrong.app/main.jsbundle',
    }
  )
})

test('refuses a build without expo-updates files', () => {
  assert.throws(
    () => embeddedUpdateEntries('app.apk', ['assets/index.android.bundle']),
    /no app\.manifest/
  )
})

test('refuses a file that is not a store build', () => {
  assert.throws(() => embeddedUpdateEntries('notes.zip', []), /expected a store build/)
})
