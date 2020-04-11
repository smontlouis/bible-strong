import defaultTheme from './default'
import darkTheme from './dark'

interface GetTheme {
  [theme: string]: Theme
}

const getTheme: GetTheme = {
  default: defaultTheme,
  dark: darkTheme,
}

export default getTheme

export type Theme = typeof defaultTheme
