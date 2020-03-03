import { Platform } from 'react-native'

const fonts = {
  android: [
    'normal',
    'notoserif',
    'sans-serif',
    'serif',
    'Roboto',
    'monospace'
  ],
  ios: [
    'Al Nile',
    'American Typewriter',
    'Arial',
    'Avenir',
    'Avenir Next',
    'Baskerville',
    'Bradley Hand',
    'Cochin',
    'Chalkboard SE',
    'Courier',
    'Damascus',
    'Didot',
    'AppleSDGothicNeo-Regular',
    'Gill Sans',
    'Helvetica',
    'Helvetica Neue',
    'Iowan Old Style',
    'Superclarendon'
  ]
}

export default fonts[Platform.OS]
