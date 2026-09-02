import { createSign } from 'node:crypto'
import serviceAccount from '../bible-strong-app-firebase-adminsdk-9xlwt-15ae218ba0'

type FirestoreValue = {
  nullValue?: null; booleanValue?: boolean; integerValue?: string; doubleValue?: number
  timestampValue?: string; stringValue?: string; bytesValue?: string; referenceValue?: string
  geoPointValue?: { latitude: number; longitude: number }
  arrayValue?: { values?: FirestoreValue[] }; mapValue?: { fields?: Record<string, FirestoreValue> }
}
type FirestoreDocument = { fields?: Record<string, FirestoreValue> }
type DocumentData = Record<string, unknown>

let tokenCache: { value: string; expiresAt: number } | undefined
const encode = (value: string | Buffer) => Buffer.from(value).toString('base64url')

async function getAccessToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.value
  if (!serviceAccount.privateKey) throw new Error('FIREBASE_PRIVATE_KEY is required to render studies')
  const issuedAt = Math.floor(Date.now() / 1000)
  const header = encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = encode(JSON.stringify({
    iss: serviceAccount.clientEmail, sub: serviceAccount.clientEmail,
    aud: 'https://oauth2.googleapis.com/token', scope: 'https://www.googleapis.com/auth/datastore',
    iat: issuedAt, exp: issuedAt + 3600,
  }))
  const unsignedToken = `${header}.${claims}`
  const signer = createSign('RSA-SHA256')
  signer.update(unsignedToken)
  signer.end()
  const assertion = `${unsignedToken}.${signer.sign(serviceAccount.privateKey, 'base64url')}`
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  })
  if (!response.ok) throw new Error(`Firebase authentication failed (${response.status})`)
  const result = await response.json() as { access_token: string; expires_in: number }
  tokenCache = { value: result.access_token, expiresAt: Date.now() + result.expires_in * 1000 }
  return tokenCache.value
}

function decodeValue(value: FirestoreValue): unknown {
  if ('nullValue' in value) return null
  if ('booleanValue' in value) return value.booleanValue
  if ('integerValue' in value) return Number(value.integerValue)
  if ('doubleValue' in value) return value.doubleValue
  if ('timestampValue' in value) return new Date(value.timestampValue!).getTime()
  if ('stringValue' in value) return value.stringValue
  if ('bytesValue' in value) return value.bytesValue
  if ('referenceValue' in value) return value.referenceValue
  if ('geoPointValue' in value) return value.geoPointValue
  if ('arrayValue' in value) return (value.arrayValue?.values ?? []).map(decodeValue)
  if ('mapValue' in value) return decodeFields(value.mapValue?.fields ?? {})
  return undefined
}

function decodeFields(fields: Record<string, FirestoreValue>): DocumentData {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]))
}

async function getDocument(collection: string, id: string) {
  const token = await getAccessToken()
  const url = `https://firestore.googleapis.com/v1/projects/${serviceAccount.projectId}/databases/(default)/documents/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`
  const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } })
  if (response.status === 404) return { exists: false, data: () => undefined }
  if (!response.ok) throw new Error(`Firestore document request failed (${response.status})`)
  const document = await response.json() as FirestoreDocument
  const data = decodeFields(document.fields ?? {})
  return { exists: true, data: () => data }
}

export const firestore = {
  collection: (collection: string) => ({ doc: (id: string) => ({ get: () => getDocument(collection, id) }) }),
}
