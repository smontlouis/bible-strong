import { describe, expect, it } from 'vitest'
import { createPageReads, pageCacheHeaders } from './pageReads'

/** A read that ends when the test says so. */
const pendingRead = <Result>() => {
  let resolve!: (value: Result) => void
  let reject!: (cause: unknown) => void
  const promise = new Promise<Result>((onResolve, onReject) => {
    resolve = onResolve
    reject = onReject
  })
  return { promise, resolve, reject }
}

const settle = () => new Promise(resolve => setTimeout(resolve, 0))

describe('createPageReads', () => {
  it('keeps to its limit of reads in flight and starts the others in the order asked', async () => {
    const reads = createPageReads(2)
    const pending = [pendingRead<string>(), pendingRead<string>(), pendingRead<string>()]
    const started: number[] = []
    const results = pending.map((read, index) =>
      reads.queue(() => {
        started.push(index)
        return read.promise
      })
    )
    await settle()
    expect(started).toEqual([0, 1])

    pending[1]?.resolve('second')
    await settle()
    expect(started).toEqual([0, 1, 2])

    pending[0]?.resolve('first')
    pending[2]?.resolve('third')
    expect(await Promise.all(results)).toEqual(['first', 'second', 'third'])
  })

  it('never passes its limit when reads end and others are asked at once', async () => {
    const reads = createPageReads(2)
    let inFlight = 0
    let most = 0
    const read = async () => {
      inFlight += 1
      most = Math.max(most, inFlight)
      await settle()
      inFlight -= 1
    }
    await Promise.all([
      ...Array.from({ length: 5 }, () => reads.queue(read)),
      reads.queue(read).then(() => Promise.all([reads.queue(read), reads.queue(read)])),
    ])
    expect(most).toBe(2)
  })

  it('gives its place back when a read fails', async () => {
    const reads = createPageReads(1)
    await expect(reads.queue(() => Promise.reject(new Error('down')))).rejects.toThrow('down')
    expect(await reads.queue(async () => 'next')).toBe('next')
  })

  it('leaves out a part that cannot be read and knows the page is incomplete', async () => {
    const reads = createPageReads()
    expect(await reads.optional(async () => 'read')).toBe('read')
    expect(reads.incomplete).toBe(false)

    expect(await reads.optional(() => Promise.reject(new Error('429')))).toBeUndefined()
    expect(reads.incomplete).toBe(true)
  })

  it('does not take a resource that does not exist for a failure', async () => {
    const reads = createPageReads()
    expect(await reads.optional(async () => undefined)).toBeUndefined()
    expect(reads.incomplete).toBe(false)
  })

  it('is incomplete when a read made elsewhere was missed', () => {
    const reads = createPageReads()
    reads.missed()
    expect(reads.incomplete).toBe(true)
  })
})

describe('pageCacheHeaders', () => {
  it('lets the CDN keep a whole page', () => {
    expect(pageCacheHeaders({})).toEqual({
      'Cache-Control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
    })
  })

  it('keeps a page missing a part it could not read for a minute only, and says so', () => {
    expect(pageCacheHeaders({ incomplete: true })).toEqual({
      'Cache-Control': 'public, max-age=0, s-maxage=60',
      'X-Page-Incomplete': '1',
    })
  })

  it('says nothing of the kind for a whole page', () => {
    expect(pageCacheHeaders({})).not.toHaveProperty('X-Page-Incomplete')
    expect(pageCacheHeaders({ incomplete: false })).not.toHaveProperty('X-Page-Incomplete')
  })

  it('keeps a page rendered with a STALE answer for a minute only, under its own name', () => {
    expect(pageCacheHeaders({}, true)).toEqual({
      'Cache-Control': 'public, max-age=0, s-maxage=60',
      'X-Page-Stale': '1',
    })
    // It is whole: nothing says it is incomplete.
    expect(pageCacheHeaders({ incomplete: false }, true)).not.toHaveProperty('X-Page-Incomplete')
  })

  it('says both of a page that is missing a part and was rendered with a STALE answer', () => {
    expect(pageCacheHeaders({ incomplete: true }, true)).toEqual({
      'Cache-Control': 'public, max-age=0, s-maxage=60',
      'X-Page-Incomplete': '1',
      'X-Page-Stale': '1',
    })
  })

  it('says nothing of a STALE answer for a page rendered from current ones', () => {
    expect(pageCacheHeaders({}, false)).not.toHaveProperty('X-Page-Stale')
    expect(pageCacheHeaders({ incomplete: true })).not.toHaveProperty('X-Page-Stale')
  })

  it('keeps the loader data of any page, which need not say whether it is incomplete', () => {
    expect(pageCacheHeaders({ language: 'fr', topics: [] })).toEqual({
      'Cache-Control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
    })
  })

  it('does not keep a failed load', () => {
    expect(pageCacheHeaders(undefined)).toBeUndefined()
    expect(pageCacheHeaders(undefined, true)).toBeUndefined()
  })
})
