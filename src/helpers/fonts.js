import { Platform } from 'react-native'

const fonts = {
  android: ['serif', 'Roboto', 'monospace'],
  ios: [
    'American Typewriter',
    'Arial',
    'Avenir',
    'Baskerville',
    'Chalkboard SE',
    'Didot',
    'Helvetica',
    'Iowan Old Style',
  ],
}

export default fonts[Platform.OS]
