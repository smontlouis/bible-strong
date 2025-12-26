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
  web: [
    'Georgia',
    'Times New Roman',
    'Arial',
    'Helvetica',
    'Verdana',
    'Trebuchet MS',
    'Courier New',
    'monospace',
  ],
}

export default fonts[Platform.OS as 'ios' | 'android' | 'web']
