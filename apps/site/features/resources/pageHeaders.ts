import { createIsomorphicFn } from '@tanstack/react-start'
import { pageCacheHeaders } from './pageReads'
import { responseIsStale } from './staleResponse'

// A route module is loaded by the browser too, where no response is built and nothing of
// the server may be imported: the server side of this function stays on the server.
const usedStaleAnswer = createIsomorphicFn()
  .server(() => responseIsStale())
  .client(() => false)

/**
 * What the CDN is told about the page a route rendered from its loader data. The route
 * passes nothing else: whether a read of the page was given a STALE answer is known from
 * the response being built, which `readResource` marked.
 */
export const resourcePageHeaders = (page: object | undefined): Record<string, string> | undefined =>
  pageCacheHeaders(page, usedStaleAnswer())
