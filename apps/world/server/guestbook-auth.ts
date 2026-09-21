export interface GuestbookAdminEnv {
  GUESTBOOK_ADMIN_EMAIL?: string
  ACCESS_TEAM_DOMAIN?: string
  ACCESS_AUD?: string
  GUESTBOOK_LOCAL_ADMIN_TOKEN?: string
}
const loopback = (host: string) => ['localhost', '127.0.0.1', '[::1]'].includes(host)
const decode = (part: string) =>
  Uint8Array.from(atob(part.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
type AccessKey = JsonWebKey & { kid: string }
const cache = new Map<string, { expires: number; keys: AccessKey[] }>()

/** Never trust an email header: verify Access's signature, audience and identity. */
export async function authenticateAdmin(
  request: Request,
  env: GuestbookAdminEnv,
  fetchImpl: typeof fetch = fetch
): Promise<string | null> {
  const email = env.GUESTBOOK_ADMIN_EMAIL?.trim().toLowerCase()
  if (!email) return null
  if (
    loopback(new URL(request.url).hostname) &&
    env.GUESTBOOK_LOCAL_ADMIN_TOKEN &&
    request.headers.get('Authorization') === `Bearer ${env.GUESTBOOK_LOCAL_ADMIN_TOKEN}`
  )
    return email
  const token = request.headers.get('Cf-Access-Jwt-Assertion')
  if (
    !token ||
    token.length > 16384 ||
    !env.ACCESS_AUD ||
    !env.ACCESS_TEAM_DOMAIN ||
    !/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ACCESS_TEAM_DOMAIN)
  )
    return null
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const header = JSON.parse(new TextDecoder().decode(decode(parts[0])))
    const claims = JSON.parse(new TextDecoder().decode(decode(parts[1])))
    const issuer = `https://${env.ACCESS_TEAM_DOMAIN}`
    const now = Date.now() / 1000
    if (
      header.alg !== 'RS256' ||
      typeof header.kid !== 'string' ||
      header.crit !== undefined ||
      claims.iss !== issuer ||
      claims.type !== 'app' ||
      !Array.isArray(claims.aud) ||
      !claims.aud.includes(env.ACCESS_AUD) ||
      typeof claims.exp !== 'number' ||
      !Number.isFinite(claims.exp) ||
      claims.exp <= now ||
      typeof claims.iat !== 'number' ||
      claims.iat > now + 60 ||
      (claims.nbf !== undefined && (typeof claims.nbf !== 'number' || claims.nbf > now)) ||
      typeof claims.email !== 'string' ||
      claims.email.toLowerCase() !== email
    )
      return null
    let keys = cache.get(issuer)
    if (!keys || keys.expires < Date.now()) {
      const response = await fetchImpl(`${issuer}/cdn-cgi/access/certs`, {
        signal: AbortSignal.timeout(5000),
      })
      if (!response.ok) return null
      const body = (await response.json()) as { keys?: AccessKey[] }
      if (!Array.isArray(body.keys) || body.keys.length > 32) return null
      keys = { keys: body.keys, expires: Date.now() + 5 * 60_000 }
      cache.set(issuer, keys)
    }
    const jwk = keys.keys.find(
      key =>
        key.kid === header.kid &&
        key.kty === 'RSA' &&
        (key.alg === undefined || key.alg === 'RS256')
    )
    if (!jwk) return null
    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    )
    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      decode(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
    )
    return valid ? email : null
  } catch {
    return null
  }
}

export function validAdminMutation(request: Request) {
  return (
    request.headers.get('Content-Type')?.split(';')[0].trim() === 'application/json' &&
    request.headers.get('X-Guestbook-Admin') === '1'
  )
}
