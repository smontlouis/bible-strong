import { Platform } from 'react-native'

const RootLayout =
  Platform.OS === 'web'
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('./RootLayout.web').default
    : // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('./RootLayout.native').default

export default RootLayout
