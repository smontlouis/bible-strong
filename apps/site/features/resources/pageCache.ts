// The pages are rendered by a Worker, whose answers Cloudflare does not keep by itself: the
// Worker keeps them, in the cache of the data centre it runs in, for as long as each answer
// says a shared cache may (`s-maxage`, ADR-0083). A deployment has its own copies: a page
// names the scripts and styles of the build that rendered it, which the next build removes.

export type PageCache = {
  match(key: Request): Promise<Response | undefined>
  put(key: Request, response: Response): Promise<void>
}

export type PageCacheOptions = {
  cache: PageCache
  /** The deployment being run. Without one (development) nothing is kept. */
  version: string | undefined
  render: (request: Request) => Promise<Response>
  /** Lets the copy be written after the answer has left. */
  defer: (task: Promise<unknown>) => void
}

/** Says, on every answer, whether it was rendered for this request or kept from an earlier one. */
export const PAGE_CACHE_HEADER = 'x-page-cache'

const VERSION_PARAMETER = '__deployment'

export const pageCacheKey = (url: string, version: string): Request => {
  const key = new URL(url)
  key.searchParams.set(VERSION_PARAMETER, version)
  return new Request(key, { method: 'GET' })
}

/** How long a shared cache may keep an answer, in seconds; nothing when it may not. */
export const sharedMaxAge = (response: Response): number => {
  const cacheControl = response.headers.get('cache-control') ?? ''
  if (/\b(?:private|no-store)\b/iu.test(cacheControl)) return 0
  return Number(/\bs-maxage=(\d+)/iu.exec(cacheControl)?.[1] ?? 0)
}

const mayBeKept = (response: Response): boolean =>
  response.status === 200 && !response.headers.has('set-cookie') && sharedMaxAge(response) > 0

const marked = (response: Response, mark: 'HIT' | 'MISS'): Response => {
  const answer = new Response(response.body, response)
  answer.headers.set(PAGE_CACHE_HEADER, mark)
  return answer
}

export const renderThroughPageCache = async (
  request: Request,
  { cache, version, render, defer }: PageCacheOptions
): Promise<Response> => {
  if (!version || (request.method !== 'GET' && request.method !== 'HEAD')) return render(request)

  const key = pageCacheKey(request.url, version)
  const kept = await cache.match(key)
  if (kept) {
    return marked(request.method === 'HEAD' ? new Response(null, kept) : kept, 'HIT')
  }

  const response = await render(request)
  // Only a whole page is written: the answer to a HEAD request has no body to keep.
  if (request.method === 'GET' && mayBeKept(response)) {
    defer(cache.put(key, response.clone()).catch(() => undefined))
  }
  return marked(response, 'MISS')
}
