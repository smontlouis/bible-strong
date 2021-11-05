import defaultTheme from './default'
import darkTheme from './dark'
import blackTheme from './black'
import sepiaTheme from './sepia'

interface GetTheme {
  [theme: string]: Theme
}

const getTheme: GetTheme = {
  default: defaultTheme,
  dark: darkTheme,
  black: blackTheme,
  sepia: sepiaTheme,
}

export default getTheme

export type Theme = typeof defaultTheme
