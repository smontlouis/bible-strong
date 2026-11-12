import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  LIBRARY_EMBEDDING_CONTRACT,
  LIBRARY_EMBEDDING_MODEL,
  withHedgedQueryEmbedding,
  type LibraryEmbeddingProvider,
  type QueryEmbeddingReport,
} from '../libraryEmbedding'

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/** A provider whose calls answer, in order, after the given delays; `fail` rejects instead. */
function scripted(calls: { ms: number; vector?: number[]; fail?: boolean }[]) {
  const started: number[] = []
  const provider: LibraryEmbeddingProvider = {
    model: LIBRARY_EMBEDDING_MODEL,
    contract: LIBRARY_EMBEDDING_CONTRACT,
    embedDocuments: async () => [],
    async embedQuery() {
      const call = calls[started.length]
      started.push(Date.now())
      await wait(call.ms)
      if (call.fail) throw new Error('UPSTREAM')
      return call.vector ?? [started.length]
    },
  }
  return { provider, started }
}

describe('a late query vector is asked twice', () => {
  const options = (reports: QueryEmbeddingReport[]) => ({
    hedgeAfterMs: 30,
    timeoutMs: 150,
    onSettled: (report: QueryEmbeddingReport) => reports.push(report),
  })

  it('asks once when the first call is on time', async () => {
    const reports: QueryEmbeddingReport[] = []
    const { provider, started } = scripted([{ ms: 5, vector: [1] }])
    assert.deepEqual(await withHedgedQueryEmbedding(provider, options(reports)).embedQuery('q'), [1])
    await wait(50)
    assert.equal(started.length, 1)
    assert.deepEqual(reports, [{ attempts: 1, timedOut: false }])
  })

  it('takes the second answer when the first is stuck', async () => {
    const reports: QueryEmbeddingReport[] = []
    const { provider, started } = scripted([{ ms: 120, vector: [1] }, { ms: 5, vector: [2] }])
    const before = Date.now()
    assert.deepEqual(await withHedgedQueryEmbedding(provider, options(reports)).embedQuery('q'), [2])
    assert.ok(Date.now() - before < 100)
    assert.equal(started.length, 2)
    assert.ok(started[1] - started[0] >= 25, 'the second call waits for the hedge delay')
    assert.deepEqual(reports, [{ attempts: 2, timedOut: false }])
  })

  it('keeps the first answer when it beats the second', async () => {
    const { provider } = scripted([{ ms: 45, vector: [1] }, { ms: 80, vector: [2] }])
    assert.deepEqual(await withHedgedQueryEmbedding(provider, options([])).embedQuery('q'), [1])
  })

  it('asks again at once when the first call fails, and fails when both do', async () => {
    const quick = scripted([{ ms: 1, fail: true }, { ms: 1, vector: [2] }])
    assert.deepEqual(await withHedgedQueryEmbedding(quick.provider, options([])).embedQuery('q'), [2])
    assert.ok(quick.started[1] - quick.started[0] < 25, 'no wait for the hedge delay after a failure')
    const broken = scripted([{ ms: 1, fail: true }, { ms: 1, fail: true }])
    await assert.rejects(withHedgedQueryEmbedding(broken.provider, options([])).embedQuery('q'), /UPSTREAM/)
  })

  it('gives up after the bound so that the words alone serve', async () => {
    const reports: QueryEmbeddingReport[] = []
    const { provider } = scripted([{ ms: 400 }, { ms: 400 }])
    const before = Date.now()
    await assert.rejects(withHedgedQueryEmbedding(provider, options(reports)).embedQuery('q'), /LIBRARY_EMBEDDING_TIMEOUT/)
    assert.ok(Date.now() - before < 300)
    assert.deepEqual(reports, [{ attempts: 2, timedOut: true }])
    await wait(300)
  })
})
