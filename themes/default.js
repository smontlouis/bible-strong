import { Platform } from 'react-native'

export default {
  colors: {
    default: 'black',
    reverse: 'white',
    border: 'rgb(230,230,230)',
    grey: '#4E4F4F',
    darkGrey: 'rgba(0,0,0,0.5)',
    primary: '#0ED3B9',
    secondary: '#FFBC00',
    tertiary: 'rgb(98,113,122)',
    tertiaryLighten: 'rgba(99, 113, 122, 0.5)',
    quart: '#1A806F'
  },
  fontFamily: {
    text: Platform.OS === 'ios' ? 'System' : 'serif',
    title: 'meta-serif',
    titleItalic: 'meta-serif-light-italic'
  }
}
