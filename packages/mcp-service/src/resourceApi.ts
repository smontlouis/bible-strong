const DEFAULT_RESOURCE_API_URL = 'https://api.bible-strong.app'
const REQUEST_TIMEOUT_MS = 10_000
const READER_ADDRESS_HEADER = 'cf-connecting-ip'

/** What a Worker binding and the global `fetch` have in common. */
export type ResourceFetcher = {
  fetch: (url: string, init?: RequestInit) => Promise<Response>
}

export class ResourceApiError extends Error {
  constructor(
    readonly status: number,
    readonly path: string
  ) {
    super(`Resource API responded ${status} for ${path}`)
    this.name = 'ResourceApiError'
  }
}

export type ResourceQuery = Record<string, string | number | boolean | undefined>

/** Reads public documents of the Resource API. An absent resource is `undefined`. */
export type ResourceReader = {
  get: <T>(path: string, query?: ResourceQuery) => Promise<T | undefined>
  post: <T>(path: string, body: unknown) => Promise<T | undefined>
}

export type ResourceReaderOptions = {
  /** The Worker binding of the Resource API; without it the API is asked at its address. */
  binding?: ResourceFetcher
  baseUrl?: string
  /**
   * The address the question is asked for. The Resource API counts what each address asks
   * of it, and a question through the binding has none of its own.
   */
  readerAddress?: string
}

export const createResourceReader = ({
  binding,
  baseUrl = DEFAULT_RESOURCE_API_URL,
  readerAddress,
}: ResourceReaderOptions = {}): ResourceReader => {
  const origin = baseUrl.replace(/\/+$/u, '')

  const ask = async <T>(path: string, url: string, init: RequestInit): Promise<T | undefined> => {
    const headers = new Headers(init.headers)
    headers.set('accept', 'application/json')
    if (binding && readerAddress) headers.set(READER_ADDRESS_HEADER, readerAddress)
    const request = { ...init, headers, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }
    const response = binding ? await binding.fetch(url, request) : await fetch(url, request)
    if (response.status === 404) return undefined
    if (!response.ok) throw new ResourceApiError(response.status, path)
    return (await response.json()) as T
  }

  return {
    get: (path, query = {}) => {
      const url = new URL(`${origin}${path}`)
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) url.searchParams.set(key, String(value))
      }
      return ask(path, url.toString(), { method: 'GET' })
    },
    post: (path, body) =>
      ask(path, `${origin}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
  }
}
