import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

import { WranglerR2ArtifactStore } from '../wranglerR2ArtifactStore'

describe('Wrangler R2 artifact store', () => {
  it('reads and writes remote objects with explicit content types', async () => {
    const calls: string[][] = []
    let uploadedBytes = ''
    const store = new WranglerR2ArtifactStore({
      bucket: 'private-bucket',
      runWrangler: async args => {
        calls.push(args)
        if (args[2] === 'get') {
          const fileIndex = args.indexOf('--file')
          await writeFile(args[fileIndex + 1]!, 'remote-bytes')
        } else if (args[2] === 'put') {
          uploadedBytes = await readFile(args[args.indexOf('--file') + 1]!, 'utf8')
        }
      },
    })

    assert.equal((await store.get('bibles/file.zip'))?.toString(), 'remote-bytes')
    await store.putBytes('bibles/file.zip.metadata.json', Buffer.from('{}\n'), 'application/json')

    assert.deepEqual(calls[0]?.slice(0, 4), [
      'r2',
      'object',
      'get',
      'private-bucket/bibles/file.zip',
    ])
    assert.ok(calls[0]?.includes('--remote'))
    assert.deepEqual(calls[1]?.slice(0, 4), [
      'r2',
      'object',
      'put',
      'private-bucket/bibles/file.zip.metadata.json',
    ])
    assert.equal(calls[1]?.at(calls[1]!.indexOf('--content-type') + 1), 'application/json')
    assert.equal(uploadedBytes, '{}\n')
  })

  it('returns undefined when the remote key does not exist', async () => {
    const store = new WranglerR2ArtifactStore({
      bucket: 'private-bucket',
      runWrangler: async () => {
        throw new Error('The specified key does not exist.')
      },
    })

    assert.equal(await store.get('missing.zip'), undefined)
  })
})
