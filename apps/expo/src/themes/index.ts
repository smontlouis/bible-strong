import blackColors from './blackColors'
import colors from './colors'
import darkColors from './darkColors'
import defaultTheme from './default'
import mauveColors from './mauveColors'
import natureColors from './natureColors'
import nightColors from './nightColors'
import sepiaColors from './sepiaColors'
import sunsetColors from './sunsetColors'

interface GetTheme {
  [theme: string]: Theme
}

export const baseTheme = {
  ...defaultTheme,
  colors,
}

const getTheme: GetTheme = {
  default: baseTheme,
  sepia: {
    ...baseTheme,
    colors: sepiaColors,
  },
  nature: {
    ...baseTheme,
    colors: natureColors,
  },
  sunset: {
    ...baseTheme,
    colors: sunsetColors,
  },
  black: {
    ...baseTheme,
    colors: blackColors,
  },
  dark: {
    ...baseTheme,
    colors: darkColors,
  },
  mauve: {
    ...baseTheme,
    colors: mauveColors,
  },
  night: {
    ...baseTheme,
    colors: nightColors,
  },
}

export default getTheme

export type Theme = typeof baseTheme

export const themeNames = [
  'default',
  'sepia',
  'nature',
  'sunset',
  'black',
  'dark',
  'mauve',
  'night',
] as const
