import { Platform } from 'react-native'
import colors from './sepiaColors'

export default {
  colors,
  measures: {
    headerHeight: 60,
    headerMarginTop: Platform.OS === 'ios' ? 0 : 25,
    maxWidth: 320,
    paddingBottom: 30,
  },
  fontFamily: {
    text: Platform.OS === 'ios' ? 'System' : 'normal',
    title: 'eina-03-bold',
    titleItalic: Platform.OS === 'ios' ? 'System' : 'normal',
  },
}
