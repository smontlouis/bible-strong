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
  web: ['Georgia', 'Arial', 'Helvetica', 'Times New Roman', 'monospace'],
}

export default fonts[Platform.OS as 'ios' | 'android' | 'web'] ?? fonts.web
