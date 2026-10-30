import { createMiddleware } from '@tanstack/react-start'
import { getRequest, setResponseHeader } from '@tanstack/react-start/server'
import { pageCacheHeaders } from './pageReads'
import { responseIsStale } from './staleResponse'

/**
 * The read of a page, asked by the browser when the reader moves to that page: kept by the CDN
 * like the page it fills, whole or for a minute. While a page is rendered the same read runs on
 * the server, and the route decides for the page.
 */
export const keptLikeAPage = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  const answer = await next()
  if (new URL(getRequest().url).pathname.startsWith('/_serverFn/')) {
    const { result: page } = answer as unknown as { result?: object }
    const headers = pageCacheHeaders(page, responseIsStale())
    for (const [name, value] of Object.entries(headers ?? {})) setResponseHeader(name, value)
  }
  return answer
})
