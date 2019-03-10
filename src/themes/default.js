import { Platform } from 'react-native'

export default {
  colors: {
    default: 'black',
    reverse: 'white',
    border: 'rgb(230,230,230)',
    grey: '#4E4F4F',
    darkGrey: 'rgba(0,0,0,0.5)',
    primary: '#0ED3B9',
    lightPrimary: '#d5fcf7',
    secondary: '#FFBC00',
    tertiary: 'rgb(98,113,122)',
    tertiaryLighten: 'rgba(99, 113, 122, 0.5)',
    quart: '#C22839'
  },
  measures: {
    headerHeight: 50,
    headerMarginTop: Platform.OS === 'ios' ? 0 : 25
  },
  fontFamily: {
    text: Platform.OS === 'ios' ? 'System' : 'serif',
    title: 'meta-serif',
    titleItalic: 'meta-serif-light-italic'
  }
}
