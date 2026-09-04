export const FIREBASE_APP_CHECK_HEADER = 'X-Firebase-AppCheck'
const RESOURCE_API_ORIGIN = 'https://api.bible-strong.app'
const RESOURCE_API_PATH_PREFIX = '/v1/'
const PUBLIC_RESOURCE_CATALOG_PATH = '/v1/offline-catalog'

export type ResourceAppCheckTokenProvider = (forceRefresh?: boolean) => Promise<string>
type ResourceAppCheckFetchOptions = { timeoutMs?: number }

const isRequestInstance = (input: RequestInfo | URL): input is Request =>
  typeof Request !== 'undefined' && input instanceof Request

const resourceApiPathname = (value: string): string | undefined => {
  if (!value.startsWith(`${RESOURCE_API_ORIGIN}/`)) return undefined
  const queryIndex = value.indexOf('?')
  const hashIndex = value.indexOf('#')
  const endIndexes = [queryIndex, hashIndex].filter(index => index >= 0)
  const endIndex = endIndexes.length ? Math.min(...endIndexes) : value.length
  return value.slice(RESOURCE_API_ORIGIN.length, endIndex)
}

export const isResourceAppCheckProtectedUrl = (input: RequestInfo | URL): boolean => {
  try {
    const value = isRequestInstance(input) ? input.url : String(input)
    const pathname = resourceApiPathname(value)
    return Boolean(
      pathname?.startsWith(RESOURCE_API_PATH_PREFIX) && pathname !== PUBLIC_RESOURCE_CATALOG_PATH
    )
  } catch {
    return false
  }
}

const requestHeaders = (input: RequestInfo | URL, init?: RequestInit): Headers => {
  const headers = new Headers(isRequestInstance(input) ? input.headers : undefined)
  new Headers(init?.headers).forEach((value, key) => headers.set(key, value))
  return headers
}

export const getResourceAppCheckHeaders = async (
  url: string,
  getToken: ResourceAppCheckTokenProvider,
  forceRefresh = false
): Promise<Record<string, string>> =>
  isResourceAppCheckProtectedUrl(url)
    ? { [FIREBASE_APP_CHECK_HEADER]: await getToken(forceRefresh) }
    : {}

const runWithRequestDeadline = <T>(
  operation: (signal: AbortSignal) => Promise<T>,
  sourceSignal: AbortSignal | undefined,
  timeoutMs: number
): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const controller = new AbortController()
    let settled = false
    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      sourceSignal?.removeEventListener('abort', abortFromCaller)
      callback()
    }
    const fail = (message: string) => {
      controller.abort()
      finish(() => reject(new Error(message)))
    }
    const abortFromCaller = () => fail('RESOURCE_REQUEST_ABORTED')
    const timeout = setTimeout(() => fail('RESOURCE_REQUEST_TIMEOUT'), timeoutMs)

    if (sourceSignal?.aborted) {
      abortFromCaller()
      return
    }
    sourceSignal?.addEventListener('abort', abortFromCaller, { once: true })

    operation(controller.signal).then(
      value => finish(() => resolve(value)),
      error => finish(() => reject(error))
    )
  })

export const createResourceAppCheckFetch = (
  fetcher: typeof fetch,
  getToken: ResourceAppCheckTokenProvider,
  { timeoutMs = 10_000 }: ResourceAppCheckFetchOptions = {}
): typeof fetch => {
  const appCheckFetch: typeof fetch = async (input, init) => {
    if (!isResourceAppCheckProtectedUrl(input)) return fetcher(input, init)

    const sourceSignal = init?.signal ?? (isRequestInstance(input) ? input.signal : undefined)
    return runWithRequestDeadline(
      async signal => {
        const send = async (forceRefresh: boolean) => {
          const headers = requestHeaders(input, init)
          headers.set(FIREBASE_APP_CHECK_HEADER, await getToken(forceRefresh))
          return fetcher(input, { ...init, headers, signal })
        }

        const response = await send(false)
        const method = (
          init?.method ?? (isRequestInstance(input) ? input.method : 'GET')
        ).toUpperCase()
        return response.status === 401 && (method === 'GET' || method === 'HEAD')
          ? send(true)
          : response
      },
      sourceSignal,
      timeoutMs
    )
  }
  return appCheckFetch
}
