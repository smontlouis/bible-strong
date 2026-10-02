import {
  NATIVE_APP_PROMPT_SNOOZE_MS,
  isIOSSafari,
  nativeAppStoreFor,
  shouldShowNativeAppPrompt,
  smartAppBannerContent,
} from '../nativeAppPrompt'

const device = (userAgent: string, maxTouchPoints = 5, standalone = false) => ({
  userAgent,
  maxTouchPoints,
  standalone,
})

const IPHONE_SAFARI = device(
  'Mozilla/5.0 (iPhone; CPU iPhone OS 26_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1'
)
const IPHONE_CHROME = device(
  'Mozilla/5.0 (iPhone; CPU iPhone OS 26_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/150.0.0.0 Mobile/15E148 Safari/604.1'
)
const IPHONE_HOME_SCREEN_APP = device(
  'Mozilla/5.0 (iPhone; CPU iPhone OS 26_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
)
const IPHONE_HOME_SCREEN_APP_SAFARI_UA = device(IPHONE_SAFARI.userAgent, 5, true)
const IPAD_DESKTOP_MODE = device(
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Safari/605.1.15'
)
const MAC_SAFARI = device(
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Safari/605.1.15',
  0
)
const ANDROID_CHROME = device(
  'Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36'
)
const WINDOWS_CHROME = device(
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36',
  0
)

describe('native app prompt', () => {
  it('maps phones and tablets to their store and keeps computers on the web app', () => {
    expect(nativeAppStoreFor(IPHONE_SAFARI)).toBe('app-store')
    expect(nativeAppStoreFor(IPAD_DESKTOP_MODE)).toBe('app-store')
    expect(nativeAppStoreFor(ANDROID_CHROME)).toBe('play-store')
    expect(nativeAppStoreFor(MAC_SAFARI)).toBeNull()
    expect(nativeAppStoreFor(WINDOWS_CHROME)).toBeNull()
  })

  it('leaves iOS Safari to the Smart App Banner', () => {
    expect(isIOSSafari(IPHONE_SAFARI)).toBe(true)
    expect(isIOSSafari(IPAD_DESKTOP_MODE)).toBe(true)
    expect(isIOSSafari(IPHONE_CHROME)).toBe(false)
    expect(isIOSSafari(IPHONE_HOME_SCREEN_APP)).toBe(false)
    expect(isIOSSafari(IPHONE_HOME_SCREEN_APP_SAFARI_UA)).toBe(false)
    expect(shouldShowNativeAppPrompt(IPHONE_SAFARI, undefined, 0)).toBe(false)
  })

  it('prompts other mobile browsers until dismissed, then again after the snooze', () => {
    expect(shouldShowNativeAppPrompt(ANDROID_CHROME, undefined, 0)).toBe(true)
    expect(shouldShowNativeAppPrompt(IPHONE_CHROME, undefined, 0)).toBe(true)
    expect(shouldShowNativeAppPrompt(IPHONE_HOME_SCREEN_APP, undefined, 0)).toBe(true)
    expect(shouldShowNativeAppPrompt(IPHONE_HOME_SCREEN_APP_SAFARI_UA, undefined, 0)).toBe(true)
    expect(
      shouldShowNativeAppPrompt(ANDROID_CHROME, 1000, 1000 + NATIVE_APP_PROMPT_SNOOZE_MS - 1)
    ).toBe(false)
    expect(
      shouldShowNativeAppPrompt(ANDROID_CHROME, 1000, 1000 + NATIVE_APP_PROMPT_SNOOZE_MS)
    ).toBe(true)
    expect(shouldShowNativeAppPrompt(WINDOWS_CHROME, undefined, 0)).toBe(false)
  })

  it('points the Smart App Banner at the same route in the iOS app', () => {
    expect(smartAppBannerContent('/home', '')).toBe(
      'app-id=1454738221, app-argument=biblestrong://home'
    )
    expect(smartAppBannerContent('/strong/dictionary', '?lang=fr')).toBe(
      'app-id=1454738221, app-argument=biblestrong://strong/dictionary?lang=fr'
    )
    expect(smartAppBannerContent('/', '')).toBe('app-id=1454738221, app-argument=biblestrong://')
  })
})
