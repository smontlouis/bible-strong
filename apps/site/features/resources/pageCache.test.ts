import { describe, expect, it, vi } from 'vitest'
import {
  PAGE_CACHE_HEADER,
  pageCacheKey,
  renderThroughPageCache,
  sharedMaxAge,
  type PageCache,
} from './pageCache'

const PAGE = 'https://bible-strong.app/bible/lsg/gen/1'
const KEPT_A_DAY = 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800'

const memoryCache = () => {
  const entries = new Map<string, Response>()
  const cache: PageCache = {
    match: async key => entries.get(key.url)?.clone(),
    put: async (key, response) => void entries.set(key.url, response),
  }
  return { cache, entries }
}

const page = (cacheControl = KEPT_A_DAY, init: ResponseInit = {}) =>
  new Response('<html>page</html>', {
    ...init,
    headers: { 'cache-control': cacheControl, ...init.headers },
  })

const through = async (
  request: Request,
  options: { cache: PageCache; version?: string; render: () => Promise<Response> }
) => {
  const tasks: Promise<unknown>[] = []
  const response = await renderThroughPageCache(request, {
    version: 'v1',
    ...options,
    defer: task => void tasks.push(task),
  })
  await Promise.all(tasks)
  return response
}

describe('Page cache of the Worker', () => {
  it('renders a page once and answers the next request from its copy', async () => {
    const { cache } = memoryCache()
    const render = vi.fn(async () => page())

    const first = await through(new Request(PAGE), { cache, render })
    const second = await through(new Request(PAGE), { cache, render })

    expect(render).toHaveBeenCalledTimes(1)
    expect(first.headers.get(PAGE_CACHE_HEADER)).toBe('MISS')
    expect(second.headers.get(PAGE_CACHE_HEADER)).toBe('HIT')
    expect(await second.text()).toBe('<html>page</html>')
  })

  it('keeps a copy per deployment, since a page names the files of its build', async () => {
    const { cache } = memoryCache()
    const render = vi.fn(async () => page())

    await through(new Request(PAGE), { cache, render, version: 'v1' })
    const afterDeployment = await through(new Request(PAGE), { cache, render, version: 'v2' })

    expect(render).toHaveBeenCalledTimes(2)
    expect(afterDeployment.headers.get(PAGE_CACHE_HEADER)).toBe('MISS')
    expect(pageCacheKey(PAGE, 'v1').url).not.toBe(pageCacheKey(PAGE, 'v2').url)
  })

  it('tells pages apart by their whole address', async () => {
    const { cache } = memoryCache()
    const render = vi.fn(async () => page())

    await through(new Request(`${PAGE}?commentary=barnes`), { cache, render })
    await through(new Request(PAGE), { cache, render })

    expect(render).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['an answer no shared cache may keep', page('public, max-age=0')],
    ['a private answer', page('private, s-maxage=60')],
    ['an answer that is not kept', page('no-store, s-maxage=60')],
    ['a missing page', page(KEPT_A_DAY, { status: 404 })],
    ['a redirect', page(KEPT_A_DAY, { status: 301 })],
    ['an answer that sets a cookie', page(KEPT_A_DAY, { headers: { 'set-cookie': 'a=b' } })],
  ])('does not keep %s', async (_, response) => {
    const { cache, entries } = memoryCache()

    await through(new Request(PAGE), { cache, render: async () => response })

    expect(entries.size).toBe(0)
  })

  it('keeps nothing in development, where no deployment is being run', async () => {
    const { cache, entries } = memoryCache()
    const render = vi.fn(async () => page())

    const response = await renderThroughPageCache(new Request(PAGE), {
      cache,
      version: undefined,
      render,
      defer: () => undefined,
    })

    expect(entries.size).toBe(0)
    expect(response.headers.has(PAGE_CACHE_HEADER)).toBe(false)
  })

  it('answers a HEAD request from the copy of the page, and writes none for it', async () => {
    const { cache, entries } = memoryCache()
    const render = vi.fn(async () => page())

    await through(new Request(PAGE, { method: 'HEAD' }), { cache, render })
    expect(entries.size).toBe(0)

    await through(new Request(PAGE), { cache, render })
    const head = await through(new Request(PAGE, { method: 'HEAD' }), { cache, render })

    expect(render).toHaveBeenCalledTimes(2)
    expect(head.headers.get(PAGE_CACHE_HEADER)).toBe('HIT')
    expect(await head.text()).toBe('')
  })

  it('renders every request that is not a read', async () => {
    const { cache, entries } = memoryCache()
    const render = vi.fn(async () => page())

    await through(new Request(PAGE, { method: 'POST' }), { cache, render })
    await through(new Request(PAGE, { method: 'POST' }), { cache, render })

    expect(render).toHaveBeenCalledTimes(2)
    expect(entries.size).toBe(0)
  })

  it('reads how long a shared cache may keep an answer', () => {
    expect(sharedMaxAge(page())).toBe(86400)
    expect(sharedMaxAge(page('public, max-age=0, s-maxage=60'))).toBe(60)
    expect(sharedMaxAge(page('public, max-age=3600'))).toBe(0)
  })
})
