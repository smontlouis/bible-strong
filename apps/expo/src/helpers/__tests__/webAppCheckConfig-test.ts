import { enableWebAppCheckDebugMode, getWebAppCheckSiteKey } from '../webAppCheckConfig'

describe('Expo Web App Check configuration', () => {
  it('requires the reCAPTCHA Enterprise site key in production', () => {
    expect(() => getWebAppCheckSiteKey(undefined, false)).toThrow(
      'Missing Expo Web Firebase App Check configuration: EXPO_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY'
    )
  })

  it('allows the Firebase debug provider to initialize locally without a production site key', () => {
    expect(getWebAppCheckSiteKey(undefined, true)).toBe('firebase-app-check-debug')
  })

  it('enables the Firebase Web debug provider only during development', () => {
    const developmentGlobal: { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string } = {}
    const productionGlobal: { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string } = {}

    enableWebAppCheckDebugMode(developmentGlobal, true)
    enableWebAppCheckDebugMode(productionGlobal, false)

    expect(developmentGlobal.FIREBASE_APPCHECK_DEBUG_TOKEN).toBe(true)
    expect(productionGlobal.FIREBASE_APPCHECK_DEBUG_TOKEN).toBeUndefined()
  })
})
