import { resourceRequestIdFrom } from '../http/requestId'
import { ResourceRateLimitedProblem } from '../http/problems'
import { FIREBASE_APP_CHECK_HEADER } from './firebaseAppCheck'
import { resourceRequestClassFrom } from './resourceRoutePolicy'

export type ResourceRateLimitCategory = 'reading' | 'search' | 'artifact'

export type ResourceRateLimitBinding = {
  limit(options: { key: string }): Promise<{ success: boolean }>
}

export type ResourceRateLimitBindings = Record<ResourceRateLimitCategory, ResourceRateLimitBinding>

const resourceCategoryFrom = (request: Request): ResourceRateLimitCategory | undefined => {
  const requestClass = resourceRequestClassFrom(request)
  return requestClass === 'reading' || requestClass === 'search' || requestClass === 'artifact'
    ? requestClass
    : undefined
}

const tokenFingerprint = async (request: Request): Promise<string> => {
  const token = request.headers.get(FIREBASE_APP_CHECK_HEADER) ?? ''
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

const protectedFailure = (requestId: string, status: 401 | 429): Response => {
  const headers = new Headers({
    'cache-control': 'private, no-store',
    'x-request-id': requestId,
  })
  if (status === 401) return new Response(null, { status, headers })
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
  reportLimited = () => undefined,
  reportFailure = () => undefined,
}: {
  request: Request
  authorize: (request: Request) => Promise<boolean>
  limiters: ResourceRateLimitBindings
  reportLimited?: (category: ResourceRateLimitCategory, requestId: string) => void
  reportFailure?: (category: ResourceRateLimitCategory, requestId: string, cause: unknown) => void
}): Promise<Response | undefined> => {
  const category = resourceCategoryFrom(request)
  if (!category) return undefined
  const requestId = resourceRequestIdFrom(request.headers.get('x-request-id') ?? undefined)
  if (!(await authorize(request))) return protectedFailure(requestId, 401)

  try {
    const { success } = await limiters[category].limit({ key: await tokenFingerprint(request) })
    if (success) return undefined
  } catch (cause) {
    reportFailure(category, requestId, cause)
    return undefined
  }

  reportLimited(category, requestId)
  return protectedFailure(requestId, 429)
}
