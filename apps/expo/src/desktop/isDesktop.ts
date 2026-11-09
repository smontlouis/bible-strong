import { Platform } from 'react-native'

import { IS_DESKTOP } from './isDesktopBuild'

export { IS_DESKTOP }

/** iOS, Android and the desktop app install Offline copies; the browser reads online only. */
export const supportsOfflineCopies = Platform.OS !== 'web' || IS_DESKTOP

/** The browser build, without the desktop app: what most `Platform.OS === 'web'` gates meant. */
export const IS_BROWSER = Platform.OS === 'web' && !IS_DESKTOP
