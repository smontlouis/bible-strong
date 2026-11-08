// Writes the archives the Rust tests decrypt, with the publication workflow's own encryption
// and the fixed test key shared by every implementation (never the production key).
//
//   yarn workspace @bible-strong/resource-service exec tsx ../../apps/desktop/scripts/make-archive-fixtures.ts
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

import {
  deriveOfflineArchivePassword,
  encryptOfflineArchive,
} from '../../../packages/resource-service/src/publication/encryptedOfflineArchive'

// zip.js is a dependency of the Resource service, which runs this script.
const { BlobWriter, TextReader, ZipWriter } = createRequire(
  join(__dirname, '../../../packages/resource-service/package.json')
)('@zip.js/zip.js') as typeof import('@zip.js/zip.js')

const fixtures = join(__dirname, '../src-tauri/tests/fixtures')
const testMasterKey = Buffer.from(Array.from({ length: 32 }, (_, index) => index + 1))

const main = async () => {
  const writer = new ZipWriter(new BlobWriter('application/zip'))
  await writer.add('bible-qa.json', new TextReader('{"QA":true}'))
  const plain = Buffer.from(await (await writer.close()).arrayBuffer())
  const plainSha256 = createHash('sha256').update(plain).digest('hex')
  const encrypted = await encryptOfflineArchive(
    plain,
    deriveOfflineArchivePassword(testMasterKey, 'bible:QA', plainSha256)
  )

  mkdirSync(fixtures, { recursive: true })
  writeFileSync(join(fixtures, 'qa.zip'), plain)
  writeFileSync(join(fixtures, 'qa.encrypted.zip'), encrypted)
  writeFileSync(join(fixtures, 'qa-plain.sha256'), `${plainSha256}\n`)
  console.log(`fixtures written to ${fixtures}`)
}

void main()
