export const RESOURCE_CORS_ALLOWED_METHODS = ['GET', 'HEAD', 'OPTIONS'] as const
export const RESOURCE_CORS_ALLOWED_HEADERS = [
  'accept',
  'content-type',
  'if-none-match',
  'x-request-id',
] as const
export const RESOURCE_CORS_EXPOSED_HEADERS = [
  'etag',
  'retry-after',
  'x-request-id',
  'x-resource-revision',
] as const

export const parseResourceCorsOrigins = (value: string | undefined): string[] =>
  value
    ?.split(',')
    .map(origin => origin.trim().replace(/\/$/, ''))
    .filter(Boolean) ?? []

const isAllowedOrigin = (origin: string, allowedOrigins: readonly string[]) =>
  allowedOrigins.includes('*') || allowedOrigins.includes(origin.replace(/\/$/, ''))

const appendVaryOrigin = (headers: Headers) => {
  const values = new Set(
    (headers.get('vary') ?? '')
      .split(',')
      .map(value => value.trim())
      .filter(Boolean)
  )
  values.add('Origin')
  headers.set('vary', [...values].join(', '))
}

export const addResourceCorsHeaders = (
  request: Request,
  headers: Headers,
  allowedOrigins: readonly string[]
) => {
  const origin = request.headers.get('origin')
  if (!origin) return false
  appendVaryOrigin(headers)
  if (!isAllowedOrigin(origin, allowedOrigins)) return false

  headers.set('access-control-allow-origin', allowedOrigins.includes('*') ? '*' : origin)
  headers.set('access-control-allow-methods', RESOURCE_CORS_ALLOWED_METHODS.join(', '))
  headers.set('access-control-allow-headers', RESOURCE_CORS_ALLOWED_HEADERS.join(', '))
  headers.set('access-control-expose-headers', RESOURCE_CORS_EXPOSED_HEADERS.join(', '))
  headers.set('access-control-max-age', '86400')
  return true
}

export const makeResourcePreflightResponse = (
  request: Request,
  allowedOrigins: readonly string[]
): Response | undefined => {
  if (request.method !== 'OPTIONS' || !request.headers.has('origin')) return undefined
  const headers = new Headers()
  if (!addResourceCorsHeaders(request, headers, allowedOrigins)) {
    return new Response(null, { status: 403 })
  }
  return new Response(null, { status: 204, headers })
}
