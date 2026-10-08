import { AsyncLocalStorage } from 'node:async_hooks'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createInstanceCache } from '../bible/instanceCache'
import { readCommentaryCoverage } from '../commentary/commentaryCoverage'
import { resourcePageHeaders } from './pageHeaders'
import { readResource } from './resourceApi'
import { answerShared, noteStaleAnswer, notingStaleAnswers } from './staleAnswers'
import { markResponseStale, resourceResponseCacheControl, responseIsStale } from './staleResponse'

// The response a request is building, as the server keeps it: each request has its own
// headers, and there are none outside a request.
const { responses } = vi.hoisted(() => ({
  responses: new (
    require('node:async_hooks') as typeof import('node:async_hooks')
  ).AsyncLocalStorage<Map<string, string>>(),
}))
vi.mock('@tanstack/react-start/server', () => {
  const headers = () => {
    const current = responses.getStore()
    if (!current) throw new Error('No StartEvent found in AsyncLocalStorage.')
    return current
  }
  return {
    setResponseHeader: (name: string, value: string) => void headers().set(name, value),
    getResponseHeader: (name: string) => headers().get(name),
  }
})

/** Runs what one request does, and gives what it answered with the headers it set. */
const request = async <Result>(handle: () => Promise<Result> | Result) => {
  const headers = new Map<string, string>()
  const result = await (responses as AsyncLocalStorage<Map<string, string>>).run(headers, handle)
  return { result, headers: Object.fromEntries(headers) }
}

const DAY = 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800'
const MINUTE = 'public, max-age=0, s-maxage=60'

/** The Resource API, answering each read with the next cache status given. */
const stubResourceApi = (...statuses: (string | undefined)[]) => {
  const fetched = vi.fn(async (_url: URL) => {
    const status = statuses.length > 1 ? statuses.shift() : statuses[0]
    return new Response(JSON.stringify({ books: [1], chaptersByBook: { '1': [1, 2] } }), {
      headers: status ? { 'x-resource-cache': status } : {},
    })
  })
  vi.stubGlobal('fetch', fetched)
  return fetched
}

const settle = () => new Promise(resolve => setTimeout(resolve, 0))

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('a STALE answer of the Resource API', () => {
  it('is returned like any other answer and noted on the response being built', async () => {
    stubResourceApi('STALE')

    const { result, headers } = await request(() => readResource('/v1/bibles/LSG/coverage'))

    expect(result).toEqual({ books: [1], chaptersByBook: { '1': [1, 2] } })
    expect(headers).toEqual({ 'X-Page-Stale': '1' })
  })

  it.each(['HIT', 'MISS', undefined])('is the only answer noted (%s)', async status => {
    stubResourceApi(status)

    const { headers } = await request(async () => {
      await readResource('/v1/bibles/LSG/coverage')
      return responseIsStale()
    })

    expect(headers).toEqual({})
  })

  it('reaches the page without its loader passing anything, and keeps it a minute', async () => {
    stubResourceApi('HIT', 'STALE', 'HIT')

    // A loader reads; the route then decides the headers from the loader data alone.
    const { result } = await request(async () => {
      const page = {
        reads: await Promise.all(['a', 'b', 'c'].map(path => readResource(`/${path}`))),
      }
      return resourcePageHeaders(page)
    })

    expect(result).toEqual({ 'Cache-Control': MINUTE, 'X-Page-Stale': '1' })
    // The page is whole: it is not called incomplete.
    expect(result).not.toHaveProperty('X-Page-Incomplete')
  })

  it('leaves a page rendered from current answers kept for the day', async () => {
    stubResourceApi('HIT')

    const { result, headers } = await request(async () => {
      await readResource('/a')
      return resourcePageHeaders({})
    })

    expect(result).toEqual({ 'Cache-Control': DAY })
    expect(headers).toEqual({})
  })

  it('marks the page that read it and no page rendered at the same time', async () => {
    const fetched = stubResourceApi()
    fetched.mockImplementation(async url => {
      await settle()
      return new Response('{}', {
        headers: { 'x-resource-cache': url.pathname === '/stale' ? 'STALE' : 'HIT' },
      })
    })
    const page = (path: string) =>
      request(async () => {
        await readResource(path)
        return resourcePageHeaders({})
      })

    const [stale, current] = await Promise.all([page('/stale'), page('/current')])

    expect(stale.result).toEqual({ 'Cache-Control': MINUTE, 'X-Page-Stale': '1' })
    expect(current.result).toEqual({ 'Cache-Control': DAY })
  })

  it('does not keep a failed load, whatever was read', async () => {
    stubResourceApi('STALE')

    const { result } = await request(async () => {
      await readResource('/a')
      return resourcePageHeaders(undefined)
    })

    expect(result).toBeUndefined()
  })

  it('keeps a preview a minute too', async () => {
    stubResourceApi('STALE', 'HIT')

    const stale = await request(async () => {
      await readResource('/a')
      return resourceResponseCacheControl()
    })
    const current = await request(async () => {
      await readResource('/a')
      return resourceResponseCacheControl()
    })

    expect(stale.result).toBe(MINUTE)
    expect(current.result).toBe(DAY)
  })

  it('is read without a response being built, and breaks nothing', async () => {
    stubResourceApi('STALE')

    expect(await readResource('/v1/bibles/LSG/coverage')).toBeDefined()
    expect(() => markResponseStale()).not.toThrow()
    expect(responseIsStale()).toBe(false)
    expect(resourceResponseCacheControl()).toBe(DAY)
  })
})

describe('notingStaleAnswers', () => {
  it('tells whether a STALE answer came into a read of several documents', async () => {
    // The last status given answers every read after it.
    stubResourceApi('HIT', 'HIT', 'STALE', 'HIT')
    const three = () => Promise.all(['a', 'b', 'c'].map(path => readResource(`/${path}`)))

    expect((await notingStaleAnswers(three)).stale).toBe(true)
    const current = await notingStaleAnswers(three)
    expect(current.stale).toBe(false)
    expect(current.value).toHaveLength(3)
  })

  it('tells each of two reads made at the same time about its own answers only', async () => {
    const read = (stale: boolean) =>
      notingStaleAnswers(async () => {
        await settle()
        if (stale) noteStaleAnswer()
        await settle()
        return stale
      })

    expect(await Promise.all([read(true), read(false), read(true)])).toEqual([
      { value: true, stale: true },
      { value: false, stale: false },
      { value: true, stale: true },
    ])
  })

  it('tells a read about the STALE answer of a read made inside it', async () => {
    const outer = await notingStaleAnswers(async () => {
      const inner = await notingStaleAnswers(async () => noteStaleAnswer())
      return inner.stale
    })

    expect(outer).toEqual({ value: true, stale: true })
  })

  it('has a page read for itself when the read it shares was given a STALE answer', async () => {
    const read = vi.fn(async () => 'current')

    expect(await answerShared(Promise.resolve({ value: 'kept', stale: false }), read)).toBe('kept')
    expect(read).not.toHaveBeenCalled()
    expect(await answerShared(Promise.resolve({ value: 'old', stale: true }), read)).toBe('current')
    expect(read).toHaveBeenCalledTimes(1)
    await expect(answerShared(Promise.reject(new Error('429')), read)).rejects.toThrow('429')
  })

  it('takes any STALE answer given meanwhile for its own where reads cannot be told apart', async () => {
    // A runtime without the storage Node gives: no read is taken for current when it is not.
    vi.resetModules()
    const builtin = vi.spyOn(process, 'getBuiltinModule').mockReturnValue(undefined as never)
    const coarse = await import('./staleAnswers')
    builtin.mockRestore()

    const stale = coarse.notingStaleAnswers(async () => {
      await settle()
      return 'read'
    })
    coarse.noteStaleAnswer()

    expect(await stale).toEqual({ value: 'read', stale: true })
    expect(await coarse.notingStaleAnswers(async () => 'read')).toEqual({
      value: 'read',
      stale: false,
    })
  })
})

describe('instance memory', () => {
  it('does not keep the coverage a STALE answer gave, and keeps the next one', async () => {
    const fetched = stubResourceApi('STALE', 'HIT')
    const page = () =>
      request(async () => {
        const coverage = await readCommentaryCoverage('stale-then-current', 'fr')
        return { coverage, headers: resourcePageHeaders({}) }
      })

    const first = await page()
    const second = await page()
    const third = await page()

    // The page rendered with the STALE coverage has it, and is kept a minute.
    expect(first.result.coverage).toEqual([{ book: 1, chapters: [1, 2] }])
    expect(first.result.headers).toEqual({ 'Cache-Control': MINUTE, 'X-Page-Stale': '1' })
    // The next page read again: the STALE answer was not kept for its hour.
    expect(fetched).toHaveBeenCalledTimes(2)
    expect(second.result.headers).toEqual({ 'Cache-Control': DAY })
    // The current answer is kept, as before.
    expect(third.result.headers).toEqual({ 'Cache-Control': DAY })
    expect(fetched).toHaveBeenCalledTimes(2)
  })

  it('leaves no page that shared a STALE read in flight kept for the day on that answer', async () => {
    // The first read is STALE and slow; the API has read again when the others ask.
    const fetched = stubResourceApi()
    fetched.mockImplementation(async () => {
      const first = fetched.mock.calls.length === 1
      if (first) await settle()
      return new Response(`{"books":[1],"chaptersByBook":{"1":[${first ? 1 : 2}]}}`, {
        headers: { 'x-resource-cache': first ? 'STALE' : 'HIT' },
      })
    })
    const page = () =>
      request(async () => {
        const coverage = await readCommentaryCoverage('shared-in-flight', 'fr')
        return { chapters: coverage?.[0]?.chapters, headers: resourcePageHeaders({}) }
      })

    const [started, ...shared] = await Promise.all([page(), page(), page()])

    // The page whose read it was is rendered with the STALE answer, and says so.
    expect(started?.result).toEqual({
      chapters: [1],
      headers: { 'Cache-Control': MINUTE, 'X-Page-Stale': '1' },
    })
    // The pages that shared the read asked again and got the current answer.
    for (const { result } of shared) {
      expect(result).toEqual({ chapters: [2], headers: { 'Cache-Control': DAY } })
    }
    expect(fetched).toHaveBeenCalledTimes(3)
  })

  it('marks a page that shared a STALE read and was given a STALE answer again', async () => {
    const fetched = stubResourceApi('STALE', 'STALE', 'HIT')
    fetched.mockImplementationOnce(async () => {
      await settle()
      return new Response('{"books":[],"chaptersByBook":{}}', {
        headers: { 'x-resource-cache': 'STALE' },
      })
    })
    const page = () =>
      request(async () => {
        await readCommentaryCoverage('shared-and-stale-again', 'fr')
        return resourcePageHeaders({})
      })

    const pages = await Promise.all([page(), page()])

    for (const { result } of pages) {
      expect(result).toEqual({ 'Cache-Control': MINUTE, 'X-Page-Stale': '1' })
    }
  })

  it('keeps for its time what no STALE answer came into', async () => {
    const cached = createInstanceCache<string>(1000)
    const read = vi.fn(async () => 'coverage')

    const pages = await Promise.all([
      request(() => cached('LSG', read)),
      request(() => cached('LSG', read)),
    ])
    await request(() => cached('LSG', read))

    expect(read).toHaveBeenCalledTimes(1)
    expect(pages.map(({ headers }) => headers)).toEqual([{}, {}])
  })

  it('reads again after a STALE answer, whoever asks next', async () => {
    const cached = createInstanceCache<string>(1000)
    let reads = 0
    const read = async () => {
      reads += 1
      if (reads === 1) noteStaleAnswer()
      return `coverage-${reads}`
    }

    expect(await cached('LSG', read)).toBe('coverage-1')
    expect(await cached('LSG', read)).toBe('coverage-2')
    expect(await cached('LSG', read)).toBe('coverage-2')
    expect(reads).toBe(2)
  })
})
