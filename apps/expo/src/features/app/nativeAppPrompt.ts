// The installable web app targets computers; phones and tablets are pointed to the native
// apps (ADR-0067). public/index.html repeats the device test inline to run before the bundle.

export const APP_STORE_ID = '1454738221'
export const APP_STORE_URL = `https://apps.apple.com/app/bible-strong/id${APP_STORE_ID}`
export const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.smontlouis.biblestrong'
export const NATIVE_APP_PROMPT_SNOOZE_MS = 30 * 24 * 60 * 60 * 1000

export type NativeAppStore = 'app-store' | 'play-store'

export type BrowserDevice = {
  userAgent: string
  maxTouchPoints: number
  // Running as a home-screen app; iOS keeps Safari's user agent there.
  standalone: boolean
}

// iPadOS reports a desktop Safari user agent; touch support tells it apart from a Mac.
export const isIOSDevice = ({ userAgent, maxTouchPoints }: BrowserDevice) =>
  /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)

// Safari shows Apple's Smart App Banner on its own; other iOS browsers, in-app browsers and
// home-screen web apps do not.
export const isIOSSafari = (device: BrowserDevice) =>
  isIOSDevice(device) &&
  !device.standalone &&
  /Version\/[\d.]+.*Safari\//.test(device.userAgent) &&
  !/(CriOS|FxiOS|EdgiOS|OPiOS)\//.test(device.userAgent)

export const nativeAppStoreFor = (device: BrowserDevice): NativeAppStore | null => {
  if (isIOSDevice(device)) return 'app-store'
  if (/Android/i.test(device.userAgent)) return 'play-store'
  return null
}

export const nativeAppStoreUrl = (store: NativeAppStore) =>
  store === 'app-store' ? APP_STORE_URL : PLAY_STORE_URL

export const shouldShowNativeAppPrompt = (
  device: BrowserDevice,
  dismissedAt: number | undefined,
  now: number
) => {
  if (!nativeAppStoreFor(device) || isIOSSafari(device)) return false
  return dismissedAt === undefined || now - dismissedAt >= NATIVE_APP_PROMPT_SNOOZE_MS
}

// Opens the same route in the iOS app from the Smart App Banner; web and native share routes.
export const smartAppBannerContent = (pathname: string, search: string) =>
  `app-id=${APP_STORE_ID}, app-argument=biblestrong://${pathname.replace(/^\/+/, '')}${search}`
