import '@emotion/react'
import { DefaultTheme } from './theme'

declare module '@emotion/react' {
  export interface Theme extends DefaultTheme {}
}
