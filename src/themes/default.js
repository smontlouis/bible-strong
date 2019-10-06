import { Platform } from 'react-native'
import { DefaultTheme } from 'react-native-paper'

import colors from './colors'

export default {
  colors,
  measures: {
    headerHeight: 50,
    headerMarginTop: Platform.OS === 'ios' ? 0 : 25,
    maxWidth: 320
  },
  fontFamily: {
    text: Platform.OS === 'ios' ? 'System' : 'normal',
    title: 'eina-03-bold',
    titleItalic: Platform.OS === 'ios' ? 'System' : 'normal'
  }
}

export const paperTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary
  }
}
