import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose'

export const FIREBASE_APP_CHECK_HEADER = 'X-Firebase-AppCheck'
const FIREBASE_APP_CHECK_JWKS_URL = new URL('https://firebaseappcheck.googleapis.com/v1/jwks')
const MAX_APP_CHECK_TOKEN_LENGTH = 8_192
const JWKS_CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1_000
// Firebase App IDs encode the client platform: `1:<project number>:<platform>:<suffix>`.
const NATIVE_FIREBASE_APP_ID = /^\d+:\d+:(?:android|ios):[^:]+$/u

const firebaseAppCheckKeys = createRemoteJWKSet(FIREBASE_APP_CHECK_JWKS_URL, {
  cacheMaxAge: JWKS_CACHE_MAX_AGE_MS,
  cooldownDuration: 30_000,
  timeoutDuration: 3_000,
})

export type FirebaseAppCheckConfig = {
  projectNumber: string
  allowedAppIds: ReadonlySet<string>
}

export const createFirebaseAppCheckConfig = ({
  projectNumber,
  allowedAppIds,
}: {
  projectNumber: string
  allowedAppIds: string
}): FirebaseAppCheckConfig => {
  const normalizedProjectNumber = projectNumber.trim()
  const normalizedAppIds = new Set(
    allowedAppIds
      .split(',')
      .map(appId => appId.trim())
      .filter(Boolean)
  )
  if (!/^\d+$/.test(normalizedProjectNumber)) {
    throw new Error('FIREBASE_APP_CHECK_PROJECT_NUMBER_INVALID')
  }
  if (normalizedAppIds.size === 0) throw new Error('FIREBASE_APP_CHECK_APP_IDS_REQUIRED')
  return { projectNumber: normalizedProjectNumber, allowedAppIds: normalizedAppIds }
}

export const isNativeFirebaseAppId = (appId: string): boolean => NATIVE_FIREBASE_APP_ID.test(appId)

/** Resolves to the verified, allow-listed App ID (`sub`), or `undefined` when attestation fails. */
export const verifyFirebaseAppCheckToken = async (
  token: string,
  config: FirebaseAppCheckConfig,
  keys: JWTVerifyGetKey = firebaseAppCheckKeys
): Promise<string | undefined> => {
  if (!token || token.length > MAX_APP_CHECK_TOKEN_LENGTH || token.split('.').length !== 3) {
    return undefined
  }
  try {
    const { payload } = await jwtVerify(token, keys, {
      algorithms: ['RS256'],
      typ: 'JWT',
      issuer: `https://firebaseappcheck.googleapis.com/${config.projectNumber}`,
      audience: `projects/${config.projectNumber}`,
      requiredClaims: ['iss', 'aud', 'exp', 'sub'],
      clockTolerance: 5,
    })
    return typeof payload.sub === 'string' && config.allowedAppIds.has(payload.sub)
      ? payload.sub
      : undefined
  } catch {
    return undefined
  }
}

export const verifyFirebaseAppCheckRequest = (
  request: Request,
  config: FirebaseAppCheckConfig,
  keys: JWTVerifyGetKey = firebaseAppCheckKeys
): Promise<string | undefined> =>
  verifyFirebaseAppCheckToken(request.headers.get(FIREBASE_APP_CHECK_HEADER) ?? '', config, keys)
