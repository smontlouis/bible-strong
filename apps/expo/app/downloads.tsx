import { Platform } from 'react-native'

// The desktop app manages Offline copies like iOS and Android; the browser has none (ADR-0107).
// Both conditions are inlined at build time, so each bundle keeps one screen.
const Screen =
  Platform.OS === 'web' && process.env.EXPO_PUBLIC_DESKTOP !== '1'
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('~features/settings/DownloadsScreen.web').default
    : // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('~features/settings/DownloadsScreen').default

export default Screen
