import type { CardFamily } from './cardCatalog'

// The palettes of the card families (`.ac-fam-*` in apps/site/src/atlas-cards.css).

export type CardPalette = {
  /** The foil of the lettering and the ring: dark, light, gleam. */
  f1: string
  f2: string
  f3: string
  /** The light edge and the glow of an opened card. */
  edge: string
  glow: string
  /** The frame: a light from the top over a diagonal ground. */
  frameTop: string
  /** The ellipse of that light, in shares of the card, and where it fades. */
  frameTopSize: [number, number]
  frameTopStop: number
  frameFrom: string
  frameTo: string
  typeInk: string
  /** The parchment, or the night panel of the spiritual beings. */
  panelFrom: string
  panelTo: string
  panelTexture: 'paper' | 'grain'
  panelInk: string
  panelDim: string
  artBg: string
  /** The lettering of the back. */
  backInk: string
  meaningInk?: string
}

const HUMAN: CardPalette = {
  f1: '#6d4e1d',
  f2: '#c9a457',
  f3: '#fff0c2',
  edge: 'hsl(210, 40%, 82%)',
  glow: 'hsl(212, 40%, 62%)',
  frameTop: '#26345a',
  frameTopSize: [1.3, 0.7],
  frameTopStop: 0.7,
  frameFrom: '#1a2440',
  frameTo: '#0c1222',
  typeInk: '#c4b991',
  panelFrom: '#f3ead3',
  panelTo: '#e4d6b4',
  panelTexture: 'paper',
  panelInk: '#2a2214',
  panelDim: '#6f6040',
  artBg: '#233a62',
  backInk: '#efe7d4',
}

/** A human with life stages: emerald instead of night blue, gold lettering kept. */
const HUMAN_STAGES: CardPalette = {
  ...HUMAN,
  f2: '#d4b062',
  f3: '#fff3cc',
  edge: 'hsl(150, 45%, 76%)',
  glow: 'hsl(160, 45%, 48%)',
  frameTop: '#1f4f43',
  frameFrom: '#133a31',
  frameTo: '#06140f',
  typeInk: '#a9c8b3',
  artBg: '#1b4a3e',
  panelFrom: '#eef0dc',
  panelTo: '#dcdcbc',
}

const DIVINE: CardPalette = {
  f1: '#8a6a2b',
  f2: '#c7a55c',
  f3: '#fff4d6',
  edge: 'hsl(48, 100%, 90%)',
  glow: 'hsl(45, 100%, 82%)',
  frameTop: '#fffdf6',
  frameTopSize: [1.2, 0.8],
  frameTopStop: 0.75,
  frameFrom: '#f6f0e2',
  frameTo: '#e3d9c2',
  typeInk: '#7a6a45',
  panelFrom: '#fffdf7',
  panelTo: '#f4ecd8',
  panelTexture: 'paper',
  panelInk: '#1b2236',
  panelDim: '#6c5e40',
  artBg: '#f3ecd9',
  backInk: '#1b2236',
}

const SPIRIT: CardPalette = {
  f1: '#5b2f8f',
  f2: '#36b6c9',
  f3: '#f6dcff',
  edge: 'hsl(250, 55%, 82%)',
  glow: 'hsl(255, 50%, 64%)',
  frameTop: '#2e1d4c',
  frameTopSize: [1.2, 0.7],
  frameTopStop: 0.7,
  frameFrom: '#1a1030',
  frameTo: '#07050f',
  typeInk: '#b6a7d9',
  panelFrom: '#1e1636',
  panelTo: '#140e26',
  panelTexture: 'grain',
  panelInk: '#efe7ff',
  panelDim: '#a898d0',
  artBg: '#1f2340',
  backInk: '#efe7ff',
}

const IDOL: CardPalette = {
  f1: '#4a3a24',
  f2: '#9c8358',
  f3: '#e6d6ad',
  edge: 'hsl(36, 28%, 58%)',
  glow: 'hsl(32, 30%, 38%)',
  frameTop: '#3d3022',
  frameTopSize: [1.3, 0.7],
  frameTopStop: 0.7,
  frameFrom: '#2b2218',
  frameTo: '#120d08',
  typeInk: '#b9a782',
  panelFrom: '#ece0c6',
  panelTo: '#d8c7a2',
  panelTexture: 'paper',
  panelInk: '#2a2214',
  panelDim: '#6f6040',
  artBg: '#2e3346',
  backInk: '#efe7d4',
  meaningInk: '#e6d6ad',
}

export const getCardPalette = (family: CardFamily, stages: boolean): CardPalette => {
  if (family === 'human') return stages ? HUMAN_STAGES : HUMAN
  if (family === 'divine') return DIVINE
  if (family === 'spirit') return SPIRIT
  return IDOL
}

/** The foil of the lettering and the ring, in the order of `foilStops`. */
export const getFoilColors = (palette: CardPalette) => [
  palette.f1,
  palette.f2,
  palette.f3,
  palette.f2,
  palette.f1,
]
