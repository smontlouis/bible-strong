import { Platform } from 'react-native'
import colors from './colors'

const theme = {
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
    paragraph: Platform.OS === 'ios' ? 'System' : 'normal',
  },
}

export default theme
