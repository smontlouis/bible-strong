import colors from '../../../../themes/colors'

type Colors = typeof colors

export interface Settings {
  fontSizeScale: number
  theme: string
  press: 'shortPress' | 'longPress'
  colors: {
    [x: string]: { [x: string]: string } & Colors
  }
  fontFamily: string
  textDisplay: string
  notesDisplay: string
}

export interface DivProps {
  settings: Settings
}

export type PropsWithDiv<P> = P & DivProps

export interface Verse {
  Livre: string
  Chapitre: string
  Verset: string
  Texte: string
}

export interface SelectedCode {
  reference?: number
}

export type Notes = { key: string; verses: string; description: string }[]
