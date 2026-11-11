import assert from 'node:assert/strict'
import test from 'node:test'
import {
  compareVersions,
  nextVersion,
  runtimeOf,
  updateVersionFromResponse,
  versionRefusal,
} from '../lib/appVersion.mjs'

test('moves the version by the part released', () => {
  assert.equal(nextVersion('28.1.0', 'patch'), '28.1.1')
  assert.equal(nextVersion('28.1.4', 'minor'), '28.2.0')
  assert.equal(nextVersion('28.1.4', 'major'), '29.0.0')
  assert.throws(() => nextVersion('28.1.0', 'build'), /Unknown release part/)
  assert.throws(() => nextVersion('28.1', 'patch'), /Unsupported app version/)
})

test('compares versions part by part, not as text', () => {
  assert.equal(compareVersions('28.1.10', '28.1.9'), 1)
  assert.equal(compareVersions('28.0.3', '28.1.0'), -1)
  assert.equal(compareVersions('28.1.0', '28.1.0'), 0)
})

test('takes the update runtime from the major and the minor', () => {
  assert.equal(runtimeOf('28.1.3'), '28.1')
})

const multipart = (boundary, parts) =>
  parts
    .map(
      ([name, body]) =>
        `--${boundary}\r\ncontent-disposition: form-data; name="${name}"\r\ncontent-type: application/json\r\n\r\n${body}\r\n`
    )
    .join('') + `--${boundary}--\r\n`

test('reads the app version of the update a server serves', () => {
  const manifest = JSON.stringify({
    id: 'update',
    runtimeVersion: '28.0',
    extra: { expoClient: { version: '28.0.3' } },
  })
  const body = multipart('b-1', [
    ['manifest', manifest],
    ['extensions', '{}'],
  ])
  assert.equal(updateVersionFromResponse('multipart/mixed; boundary=b-1', body), '28.0.3')
})

test('finds no update when the server answers with a directive', () => {
  const body = multipart('b-2', [['directive', '{"type":"noUpdateAvailable"}']])
  assert.equal(updateVersionFromResponse('multipart/mixed; boundary="b-2"', body), null)
  assert.throws(() => updateVersionFromResponse('application/json', '{}'), /Not a multipart/)
})

test('refuses a version already shipped unless the same version is allowed', () => {
  const shipped = [{ what: 'the last Android production build', version: '28.1.0' }]
  assert.match(versionRefusal({ version: '28.1.0', shipped }), /already the version/)
  assert.equal(versionRefusal({ version: '28.1.0', shipped, sameVersion: true }), null)
  assert.equal(versionRefusal({ version: '28.1.1', shipped }), null)
  assert.equal(versionRefusal({ version: '28.1.0', shipped: [] }), null)
})

test('never lets an older version through', () => {
  const shipped = [{ what: 'the update served to iOS', version: '28.1.2' }]
  assert.match(
    versionRefusal({ version: '28.1.1', shipped, sameVersion: true }),
    /older than the update served to iOS/
  )
})

test('compares only with what went out on the same runtime', () => {
  // A fix for the 28.0 binaries, from a release/28.0 branch, after master's 28.1 builds.
  const shipped = [
    { what: 'the last iOS production build', version: '28.1.0' },
    { what: 'the update served to iOS', version: '28.0.3' },
  ]
  assert.equal(versionRefusal({ version: '28.0.4', shipped }), null)
  assert.match(versionRefusal({ version: '28.0.3', shipped }), /update served to iOS/)
})
