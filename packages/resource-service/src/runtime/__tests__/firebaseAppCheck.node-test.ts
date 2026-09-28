import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose'

import {
  FIREBASE_APP_CHECK_HEADER,
  createFirebaseAppCheckConfig,
  isNativeFirebaseAppId,
  verifyFirebaseAppCheckRequest,
  verifyFirebaseAppCheckToken,
} from '../firebaseAppCheck'

const projectNumber = '204116128917'
const appId = '1:204116128917:ios:test'

const createFixture = async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256')
  const publicJwk = await exportJWK(publicKey)
  const keys = createLocalJWKSet({ keys: [{ ...publicJwk, alg: 'RS256', kid: 'test-key' }] })
  const sign = ({
    subject = appId,
    issuer = `https://firebaseappcheck.googleapis.com/${projectNumber}`,
    audience = `projects/${projectNumber}`,
    expiresIn = '1h',
  }: {
    subject?: string
    issuer?: string
    audience?: string
    expiresIn?: string
  } = {}) =>
    new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT', kid: 'test-key' })
      .setSubject(subject)
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .sign(privateKey)
  return { keys, sign }
}

describe('Firebase App Check verification', () => {
  it('verifies the signature, issuer, audience, expiration, and allow-listed App ID', async () => {
    const { keys, sign } = await createFixture()
    const config = createFirebaseAppCheckConfig({ projectNumber, allowedAppIds: appId })

    assert.equal(await verifyFirebaseAppCheckToken(await sign(), config, keys), appId)
    assert.equal(
      await verifyFirebaseAppCheckToken(
        await sign({ issuer: 'https://firebaseappcheck.googleapis.com/999' }),
        config,
        keys
      ),
      undefined
    )
    assert.equal(
      await verifyFirebaseAppCheckToken(await sign({ audience: 'projects/999' }), config, keys),
      undefined
    )
    assert.equal(
      await verifyFirebaseAppCheckToken(
        await sign({ subject: '1:204116128917:ios:unknown' }),
        config,
        keys
      ),
      undefined
    )
    assert.equal(
      await verifyFirebaseAppCheckToken(await sign({ expiresIn: '-10s' }), config, keys),
      undefined
    )
  })

  it('rejects missing, malformed, and tampered request tokens', async () => {
    const { keys, sign } = await createFixture()
    const config = createFirebaseAppCheckConfig({ projectNumber, allowedAppIds: appId })
    const token = await sign()
    const request = new Request('https://api.bible-strong.app/v1/offline-artifacts/file.zip', {
      headers: { [FIREBASE_APP_CHECK_HEADER]: token },
    })

    assert.equal(await verifyFirebaseAppCheckRequest(request, config, keys), appId)
    assert.equal(
      await verifyFirebaseAppCheckRequest(
        new Request('https://api.bible-strong.app/v1/offline-artifacts/file.zip'),
        config
      ),
      undefined
    )
    assert.equal(await verifyFirebaseAppCheckToken(`${token}tampered`, config, keys), undefined)
    assert.equal(await verifyFirebaseAppCheckToken('not-a-jwt', config, keys), undefined)
  })

  it('recognizes native App IDs from the platform encoded by Firebase', () => {
    assert.equal(isNativeFirebaseAppId('1:204116128917:android:3ae4e716f079e5a002579c'), true)
    assert.equal(isNativeFirebaseAppId('1:204116128917:ios:116748d319a72c8c02579c'), true)
    assert.equal(isNativeFirebaseAppId('1:204116128917:web:6ec6a6562ad7957402579c'), false)
    assert.equal(isNativeFirebaseAppId('1:204116128917:androidx:3ae4e716f079e5a002579c'), false)
    assert.equal(isNativeFirebaseAppId('android'), false)
    assert.equal(isNativeFirebaseAppId(''), false)
  })

  it('rejects invalid Worker configuration before serving requests', () => {
    assert.throws(
      () => createFirebaseAppCheckConfig({ projectNumber: 'project-name', allowedAppIds: appId }),
      /FIREBASE_APP_CHECK_PROJECT_NUMBER_INVALID/
    )
    assert.throws(
      () => createFirebaseAppCheckConfig({ projectNumber, allowedAppIds: '  ' }),
      /FIREBASE_APP_CHECK_APP_IDS_REQUIRED/
    )
  })
})
