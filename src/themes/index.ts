import defaultTheme from './default'
import darkTheme from './dark'
import blackTheme from './black'

interface GetTheme {
  [theme: string]: Theme
}

const getTheme: GetTheme = {
  default: defaultTheme,
  dark: darkTheme,
  black: blackTheme,
}

export default getTheme

export type Theme = typeof defaultTheme
