export const FIREBASE_APP_CHECK_HEADER = 'X-Firebase-AppCheck'
const RESOURCE_API_HOSTNAME = 'api.bible-strong.app'
const RESOURCE_ARTIFACT_PATH_PREFIX = '/v1/offline-artifacts/'

export type ResourceAppCheckTokenProvider = (forceRefresh?: boolean) => Promise<string>

export const isResourceAppCheckProtectedUrl = (input: RequestInfo | URL): boolean => {
  try {
    const value = input instanceof Request ? input.url : input.toString()
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      url.hostname === RESOURCE_API_HOSTNAME &&
      url.pathname.startsWith(RESOURCE_ARTIFACT_PATH_PREFIX)
    )
  } catch {
    return false
  }
}

const requestHeaders = (input: RequestInfo | URL, init?: RequestInit): Headers => {
  const headers = new Headers(input instanceof Request ? input.headers : undefined)
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

export const createResourceAppCheckFetch = (
  fetcher: typeof fetch,
  getToken: ResourceAppCheckTokenProvider
): typeof fetch => {
  const appCheckFetch: typeof fetch = async (input, init) => {
    if (!isResourceAppCheckProtectedUrl(input)) return fetcher(input, init)

    const send = async (forceRefresh: boolean) => {
      const headers = requestHeaders(input, init)
      headers.set(FIREBASE_APP_CHECK_HEADER, await getToken(forceRefresh))
      return fetcher(input, { ...init, headers })
    }

    const response = await send(false)
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
    return response.status === 401 && (method === 'GET' || method === 'HEAD')
      ? send(true)
      : response
  }
  return appCheckFetch
}
