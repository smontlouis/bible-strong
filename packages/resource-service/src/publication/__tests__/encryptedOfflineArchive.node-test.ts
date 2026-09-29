import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { describe, it } from 'node:test'

import { BlobWriter, TextReader, Uint8ArrayReader, ZipReader, ZipWriter } from '@zip.js/zip.js'

import {
  deriveOfflineArchivePassword,
  encryptedArchiveFile,
  encryptedArchiveIndexKey,
  encryptOfflineArchive,
  ensureEncryptedOfflineArchive,
  latestArchiveKeyVersion,
  parseArchiveKeys,
  verifyEncryptedOfflineArchive,
} from '../encryptedOfflineArchive'
import { immutableR2ArtifactKey, type R2ArtifactStore } from '../r2ArtifactPublisher'

// Same fixed test key and vector as the native module tests (never the production key).
const testMasterKey = Buffer.from(Array.from({ length: 32 }, (_, index) => index + 1))
const testKeys = new Map([[1, testMasterKey]])
const apiOrigin = 'https://api.bible-strong.app'

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')

const plainZip = async (files: Record<string, string>) => {
  const writer = new ZipWriter(new BlobWriter('application/zip'))
  for (const [name, content] of Object.entries(files)) {
    await writer.add(name, new TextReader(content))
  }
  return Buffer.from(await (await writer.close()).arrayBuffer())
}

class MemoryR2ArtifactStore implements R2ArtifactStore {
  readonly objects = new Map<string, Buffer>()
  readonly reads: string[] = []

  async get(key: string) {
    this.reads.push(key)
    return this.objects.get(key)
  }

  async putFile(): Promise<void> {
    throw new Error('UNEXPECTED_PUT_FILE')
  }

  async putBytes(key: string, bytes: Buffer) {
    this.objects.set(key, Buffer.from(bytes))
  }
}

describe('Encrypted Offline copies', () => {
  it('parses versioned keys and selects the latest version', () => {
    const second = Buffer.alloc(32, 9)
    const keys = parseArchiveKeys(
      ` 1:${testMasterKey.toString('base64')},2:${second.toString('base64')}`
    )

    assert.deepEqual([...keys.keys()], [1, 2])
    assert.equal(latestArchiveKeyVersion(keys), 2)
    assert.throws(() => latestArchiveKeyVersion(parseArchiveKeys('')), /REQUIRED/)
    assert.throws(() => parseArchiveKeys(`1:${Buffer.alloc(16).toString('base64')}`), /LENGTH/)
    assert.throws(() => parseArchiveKeys('x:abc'), /KEYS_INVALID/)
  })

  it('derives the password pinned by the native module tests', () => {
    assert.equal(
      deriveOfflineArchivePassword(
        testMasterKey,
        'bible:QA',
        'a8671609da0052a7afd556651e091882ec848675317f5642efab84346a333354'
      ),
      'a4fa97894dc44cbfd4b1bc6aa5e64427a4edfe333bbcfc04dccaa3e47d669c94'
    )
    assert.throws(() => deriveOfflineArchivePassword(testMasterKey, 'bible:QA', 'nope'), /INPUT/)
  })

  it('names encrypted copies next to their plain archive', () => {
    assert.equal(
      encryptedArchiveFile('bibles/bible-lsg.json.zip'),
      'bibles/bible-lsg.json.encrypted.zip'
    )
    assert.throws(() => encryptedArchiveFile('bibles/bible-lsg.json'), /SOURCE_INVALID/)
  })

  it('encrypts every entry and verifies them against the plain content', async () => {
    const plain = await plainZip({ 'bible.json': '{"b":1}', 'pericope.json': '{"p":2}' })
    const password = 'a'.repeat(64)
    const encrypted = await encryptOfflineArchive(plain, password)
    const expected = new Map([
      ['bible.json', sha256(Buffer.from('{"b":1}'))],
      ['pericope.json', sha256(Buffer.from('{"p":2}'))],
    ])

    await verifyEncryptedOfflineArchive(encrypted, password, expected)
    const reader = new ZipReader(new Uint8ArrayReader(encrypted))
    assert.ok((await reader.getEntries()).every(entry => entry.encrypted))
    await reader.close()
    await assert.rejects(
      verifyEncryptedOfflineArchive(encrypted, password, new Map([...expected, ['x', 'y']])),
      /ENTRY_COUNT_MISMATCH/
    )
    await assert.rejects(
      verifyEncryptedOfflineArchive(
        encrypted,
        password,
        new Map([
          ['bible.json', 'bad'],
          ['pericope.json', 'bad'],
        ])
      ),
      /ENTRY_MISMATCH/
    )
  })

  it('encrypts once, uploads the object before its index, then reuses the index', async () => {
    const plain = await plainZip({ 'bible-lsg.json': '{"lsg":true}' })
    const entry = {
      id: 'bible:LSG',
      file: 'bibles/bible-lsg.json.zip',
      archiveSha256: sha256(plain),
    }
    const store = new MemoryR2ArtifactStore()
    store.objects.set(immutableR2ArtifactKey(entry.file, entry.archiveSha256), plain)

    const first = await ensureEncryptedOfflineArchive({
      entry,
      store,
      keys: testKeys,
      keyVersion: 1,
      apiOrigin,
    })
    assert.equal(first.status, 'encrypted')
    const { descriptor } = first
    assert.equal(descriptor.file, 'bibles/bible-lsg.json.encrypted.zip')
    assert.equal(descriptor.keyVersion, 1)
    assert.equal(
      descriptor.url,
      `${apiOrigin}/v1/offline-archives/bibles/bible-lsg.json.encrypted.zip?sha256=${descriptor.sha256}`
    )
    const stored = store.objects.get(immutableR2ArtifactKey(descriptor.file, descriptor.sha256))
    assert.ok(stored)
    assert.equal(sha256(stored), descriptor.sha256)
    assert.equal(stored.byteLength, descriptor.bytes)
    const password = deriveOfflineArchivePassword(testMasterKey, entry.id, entry.archiveSha256)
    await verifyEncryptedOfflineArchive(
      stored,
      password,
      new Map([['bible-lsg.json', sha256(Buffer.from('{"lsg":true}'))]])
    )

    store.reads.length = 0
    const second = await ensureEncryptedOfflineArchive({
      entry,
      store,
      keys: testKeys,
      keyVersion: 1,
      apiOrigin,
    })
    assert.deepEqual(second, { status: 'indexed', descriptor })
    assert.deepEqual(store.reads, [encryptedArchiveIndexKey(1, entry.archiveSha256)])
  })

  it('falls back to the stable key of an older publication and rejects wrong bytes', async () => {
    const plain = await plainZip({ 'nave.sqlite': 'sqlite' })
    const entry = {
      id: 'database:NAVE:fr',
      file: 'databases/nave-fr.sqlite.zip',
      archiveSha256: sha256(plain),
    }
    const store = new MemoryR2ArtifactStore()
    store.objects.set(entry.file, plain)

    const result = await ensureEncryptedOfflineArchive({
      entry,
      store,
      keys: testKeys,
      keyVersion: 1,
      apiOrigin,
    })
    assert.equal(result.status, 'encrypted')

    const tampered = new MemoryR2ArtifactStore()
    tampered.objects.set(entry.file, await plainZip({ 'nave.sqlite': 'other' }))
    await assert.rejects(
      ensureEncryptedOfflineArchive({
        entry,
        store: tampered,
        keys: testKeys,
        keyVersion: 1,
        apiOrigin,
      }),
      /PLAIN_SOURCE_MISSING:database:NAVE:fr/
    )
  })

  it('writes nothing to R2 during a dry run', async () => {
    const plain = await plainZip({ 'bible-kjv.json': '{}' })
    const entry = {
      id: 'bible:KJV',
      file: 'bibles/bible-kjv.json.zip',
      archiveSha256: sha256(plain),
    }
    const store = new MemoryR2ArtifactStore()
    store.objects.set(entry.file, plain)

    const result = await ensureEncryptedOfflineArchive({
      entry,
      store,
      keys: testKeys,
      keyVersion: 1,
      apiOrigin,
      dryRun: true,
    })

    assert.equal(result.status, 'verified-only')
    assert.deepEqual([...store.objects.keys()], [entry.file])
  })

  it('refuses a key version the environment does not hold', async () => {
    await assert.rejects(
      ensureEncryptedOfflineArchive({
        entry: {
          id: 'bible:LSG',
          file: 'bibles/bible-lsg.json.zip',
          archiveSha256: 'a'.repeat(64),
        },
        store: new MemoryR2ArtifactStore(),
        keys: testKeys,
        keyVersion: 2,
        apiOrigin,
      }),
      /KEY_MISSING:2/
    )
  })
})
