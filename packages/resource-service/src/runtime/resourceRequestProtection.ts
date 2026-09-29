import { resourceRequestIdFrom } from '../http/requestId'
import { ResourceRateLimitedProblem } from '../http/problems'
import { FIREBASE_APP_CHECK_HEADER, isNativeFirebaseAppId } from './firebaseAppCheck'
import { resourceRequestClassFrom } from './resourceRoutePolicy'

export type ResourceRateLimitCategory = 'reading' | 'search' | 'semantic-search' | 'artifact'

export type ResourceRateLimitBinding = {
  limit(options: { key: string }): Promise<{ success: boolean }>
}

export type ResourceRateLimitBindings = Record<ResourceRateLimitCategory, ResourceRateLimitBinding>

const resourceCategoryFrom = (request: Request): ResourceRateLimitCategory | undefined => {
  const requestClass = resourceRequestClassFrom(request)
  if (requestClass === 'search' && new URL(request.url).pathname.endsWith('/semantic-search')) {
    return 'semantic-search'
  }
  return requestClass === 'reading' || requestClass === 'search' || requestClass === 'artifact'
    ? requestClass
    : undefined
}

// Public routes are counted per client address. Cloudflare always sets this header in production.
const clientAddressKey = (request: Request): string =>
  `address:${request.headers.get('cf-connecting-ip') ?? 'unknown'}`

const tokenFingerprint = async (request: Request): Promise<string> => {
  const token = request.headers.get(FIREBASE_APP_CHECK_HEADER) ?? ''
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

const protectedFailure = (requestId: string, status: 401 | 403 | 429): Response => {
  const headers = new Headers({
    'cache-control': 'private, no-store',
    'x-request-id': requestId,
  })
  if (status !== 429) return new Response(null, { status, headers })
  headers.set('retry-after', '60')
  return Response.json(
    new ResourceRateLimitedProblem({
      type: 'https://bible-strong.app/problems/resource-rate-limited',
      title: 'Resource request rate limited',
      detail: 'Too many resource requests. Retry after 60 seconds.',
      requestId,
      status,
      code: 'RESOURCE_RATE_LIMITED',
      retryAfterSeconds: 60,
    }),
    { status, headers }
  )
}

export const protectResourceRequest = async ({
  request,
  authorize,
  limiters,
  reportForbidden = () => undefined,
  reportLimited = () => undefined,
  reportFailure = () => undefined,
}: {
  request: Request
  /** Resolves to the verified App ID of the attested client, or `undefined`. Offline copies only. */
  authorize: (request: Request) => Promise<string | undefined>
  limiters: ResourceRateLimitBindings
  reportForbidden?: (category: ResourceRateLimitCategory, requestId: string, appId: string) => void
  reportLimited?: (category: ResourceRateLimitCategory, requestId: string) => void
  reportFailure?: (category: ResourceRateLimitCategory, requestId: string, cause: unknown) => void
}): Promise<Response | undefined> => {
  const category = resourceCategoryFrom(request)
  if (!category) return undefined
  const requestId = resourceRequestIdFrom(request.headers.get('x-request-id') ?? undefined)
  let limitKey = clientAddressKey(request)
  // Online reading and search are public (ADR-0065); App Check tokens they carry are ignored.
  // A plain Offline copy is a complete resource. Only native clients install them, and their
  // attestation is far harder to obtain than a Web token copied from a browser session.
  if (category === 'artifact') {
    const appId = await authorize(request)
    if (!appId) return protectedFailure(requestId, 401)
    if (!isNativeFirebaseAppId(appId)) {
      reportForbidden(category, requestId, appId)
      return protectedFailure(requestId, 403)
    }
    limitKey = await tokenFingerprint(request)
  }

  try {
    const { success } = await limiters[category].limit({ key: limitKey })
    if (success) return undefined
  } catch (cause) {
    reportFailure(category, requestId, cause)
    return undefined
  }

  reportLimited(category, requestId)
  return protectedFailure(requestId, 429)
}
