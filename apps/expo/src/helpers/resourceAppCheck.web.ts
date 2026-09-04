import {
  getToken,
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  type AppCheck,
} from 'firebase/app-check'

import { firebaseApp } from './firebaseApp.web'
import {
  createResourceAppCheckFetch,
  isResourceAppCheckProtectedUrl,
} from './resourceAppCheckRequest'
import { appLogger } from './agentObservability'
import {
  enableWebAppCheckDebugMode,
  getWebAppCheckSiteKey,
  type FirebaseAppCheckDebugGlobal,
} from './webAppCheckConfig'

let appCheckInitialization: Promise<AppCheck> | undefined

export const initializeResourceAppCheck = (): Promise<AppCheck> => {
  if (appCheckInitialization) return appCheckInitialization

  enableWebAppCheckDebugMode(globalThis as FirebaseAppCheckDebugGlobal, __DEV__)
  const siteKey = getWebAppCheckSiteKey(
    process.env.EXPO_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY,
    __DEV__
  )
  appCheckInitialization = Promise.resolve(
    initializeAppCheck(firebaseApp, {
      provider: new ReCaptchaEnterpriseProvider(siteKey),
      isTokenAutoRefreshEnabled: true,
    })
  )
  return appCheckInitialization
}

const getAppCheckFailureCode = (error: unknown): string => {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    const providerCode = error.code
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toUpperCase()
    if (providerCode) return `RESOURCE_${providerCode}`
  }
  return 'RESOURCE_APP_CHECK_TOKEN_FAILED'
}

export class ResourceAppCheckError extends Error {
  constructor(
    readonly code: string,
    readonly cause: unknown
  ) {
    super(code)
    this.name = 'ResourceAppCheckError'
  }
}

export const getResourceAppCheckToken = async (forceRefresh = false): Promise<string> => {
  try {
    const result = await getToken(await initializeResourceAppCheck(), forceRefresh)
    if (!result.token) throw new Error('RESOURCE_APP_CHECK_TOKEN_MISSING')
    return result.token
  } catch (error) {
    const errorCode =
      error instanceof ResourceAppCheckError ? error.code : getAppCheckFailureCode(error)
    appLogger.captureError('download', 'resource_app_check.token_failed', error, {
      forceRefresh,
      errorCode,
    })
    throw error instanceof ResourceAppCheckError
      ? error
      : new ResourceAppCheckError(errorCode, error)
  }
}

const guardedResourceApiFetch = createResourceAppCheckFetch(fetch, getResourceAppCheckToken)

const requestDiagnostics = (input: RequestInfo | URL, init?: RequestInit) => {
  const requestUrl = input instanceof Request ? input.url : input.toString()
  try {
    const url = new URL(requestUrl)
    return {
      method: (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase(),
      requestHost: url.hostname,
      requestPath: url.pathname,
    }
  } catch {
    return { method: init?.method?.toUpperCase() ?? 'GET' }
  }
}

export const resourceApiFetch: typeof fetch = async (input, init) => {
  const response = await guardedResourceApiFetch(input, init)
  const diagnostics = requestDiagnostics(input, init)
  if (
    isResourceAppCheckProtectedUrl(input) &&
    (response.status === 401 ||
      response.status === 403 ||
      response.status === 429 ||
      response.status >= 500)
  ) {
    appLogger.captureError(
      'download',
      'resource_api.protected_request_failed',
      new Error(`RESOURCE_API_HTTP_${response.status}`),
      {
        ...requestDiagnostics(input, init),
        httpStatus: response.status,
        requestId: response.headers.get('x-request-id') ?? undefined,
        retryAfter: response.headers.get('retry-after') ?? undefined,
      }
    )
  }
  return response
}

export const getResourceDownloadAppCheckToken = (
  url: string,
  forceRefresh = false
): Promise<string> => {
  if (!isResourceAppCheckProtectedUrl(url)) {
    const cause = new Error('RESOURCE_APP_CHECK_DOWNLOAD_URL_UNTRUSTED')
    throw new ResourceAppCheckError(cause.message, cause)
  }
  return getResourceAppCheckToken(forceRefresh)
}
