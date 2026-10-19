import '../global.css'
import { Platform } from 'react-native'

export { default } from '~features/app/RootLayout'

// A link that opens the application on a sheet (a public Bible page, a Strong entry…) needs
// the home beneath it: a native sheet cannot be the first screen of a stack, and the home is
// where the reader returns when the sheet closes. The Web frame closes to the home itself.
export const unstable_settings = Platform.OS === 'web' ? {} : { anchor: 'index' }
