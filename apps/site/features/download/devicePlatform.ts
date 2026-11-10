/** The systems the site offers Bible Strong for, by what a reader recognises. */
export type DevicePlatform = 'ios' | 'android' | 'mac' | 'windows' | 'linux'

type DeviceSignals = {
  userAgent: string
  /** `navigator.platform`, which an iPad reports as a Mac. */
  platform?: string
  maxTouchPoints?: number
}

/**
 * The system of the device a page is read on, from what the browser says of it; nothing when
 * it cannot be told. An iPad asks for the desktop site and reports a Mac, which has no touch
 * screen. A Chromebook installs Android apps from Google Play.
 */
export const devicePlatform = ({
  userAgent,
  platform = '',
  maxTouchPoints = 0,
}: DeviceSignals): DevicePlatform | undefined => {
  if (/iPhone|iPad|iPod/iu.test(userAgent)) return 'ios'
  // Before the platform, which a browser may report as it pleases.
  if (/Android|CrOS/iu.test(userAgent)) return 'android'
  if (/Macintosh|Mac OS X/iu.test(userAgent) || /^Mac/iu.test(platform)) {
    return maxTouchPoints > 1 ? 'ios' : 'mac'
  }
  if (/Windows/iu.test(userAgent)) return 'windows'
  if (/Linux|X11/iu.test(userAgent)) return 'linux'
  return undefined
}

/** The system of the device the page is read on, in a browser. */
export const currentDevicePlatform = (): DevicePlatform | undefined =>
  typeof navigator === 'undefined'
    ? undefined
    : devicePlatform({
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        maxTouchPoints: navigator.maxTouchPoints,
      })

/** Whether the system runs the desktop app. */
export const isDesktopPlatform = (platform: DevicePlatform | undefined): boolean =>
  platform === 'mac' || platform === 'windows' || platform === 'linux'
