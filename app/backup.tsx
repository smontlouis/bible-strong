import { Platform } from 'react-native'

const Screen =
  Platform.OS === 'web'
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('~features/settings/BackupScreen.web').default
    : // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('~features/settings/BackupScreen').default

export default Screen
