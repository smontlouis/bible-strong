import defaultTheme from './default'
import colors from './colors'
import sepiaColors from './sepiaColors'
import darkColors from './darkColors'
import blackColors from './blackColors'
import natureColors from './natureColors'
import sunsetColors from './sunsetColors'
import mauveColors from './mauveColors'
import nightColors from './nightColors'

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
type BaseTheme = typeof baseTheme

import '@emotion/react'

declare module '@emotion/react' {
  export interface Theme extends BaseTheme {}
}
