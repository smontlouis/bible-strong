import { createIsomorphicFn } from '@tanstack/react-start'
import { noteStaleAnswer } from './staleAnswers'
import { markResponseStale } from './staleResponse'

const DEFAULT_RESOURCE_API_URL = 'https://api.bible-strong.app'
const REQUEST_TIMEOUT_MS = 10_000
// How the Resource API marks an answer stored by an earlier version of itself (ADR-0076).
const RESOURCE_CACHE_HEADER = 'x-resource-cache'

// The browser loads this module with the pages that read on the server, and builds no
// response: the mark and what it imports stay on the server.
const markStaleResponse = createIsomorphicFn()
  .server(() => markResponseStale())
  .client(() => undefined)

export class ResourceApiError extends Error {
  constructor(
    readonly status: number,
    readonly path: string
  ) {
    super(`Resource API responded ${status} for ${path}`)
    this.name = 'ResourceApiError'
  }
}

type ResourceQuery = Record<string, string | number | undefined>

/**
 * Reads one public Resource API document from the server (ADR-0065).
 * An absent resource resolves to `undefined`; any other failure throws. A STALE answer is
 * returned like any other, noted for the read it came into and marked on the response being
 * built, which is then kept for a minute only.
 */
export async function readResource<T>(
  path: string,
  query: ResourceQuery = {}
): Promise<T | undefined> {
  const baseUrl = (process.env.RESOURCE_API_URL ?? DEFAULT_RESOURCE_API_URL).replace(/\/+$/u, '')
  const url = new URL(`${baseUrl}${path}`)
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) url.searchParams.set(key, String(value))
  }
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (response.status === 404) return undefined
  if (!response.ok) throw new ResourceApiError(response.status, path)
  if (response.headers.get(RESOURCE_CACHE_HEADER) === 'STALE') {
    noteStaleAnswer()
    markStaleResponse()
  }
  return (await response.json()) as T
}

/** Posts a JSON request to a public Resource API route; an absent resource is `undefined`. */
export async function postResource<T>(path: string, body: unknown): Promise<T | undefined> {
  const baseUrl = (process.env.RESOURCE_API_URL ?? DEFAULT_RESOURCE_API_URL).replace(/\/+$/u, '')
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (response.status === 404) return undefined
  if (!response.ok) throw new ResourceApiError(response.status, path)
  return (await response.json()) as T
}
