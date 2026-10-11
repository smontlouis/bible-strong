/** A face the renderer may set text in; it reads TrueType and OpenType, not WOFF2. */
export type ShareCardFont = {
  name: string
  data: ArrayBuffer
  weight: 400 | 500 | 600 | 800
  style: 'normal'
}

export const SANS = 'Pulp Display'
// The site's Literata has no Greek and no Hebrew letters: an original word falls through to
// the Greek cut of Literata, then to Frank Ruhl Libre.
export const SERIF = 'Literata, Literata Greek, Frank Ruhl Libre'

/** The files of those faces, among the public fonts of the site. */
export const SHARE_CARD_FONT_FILES: readonly (Omit<ShareCardFont, 'data'> & { file: string })[] = [
  { name: 'Pulp Display', weight: 500, style: 'normal', file: 'UpType - Pulp Display Medium.otf' },
  { name: 'Pulp Display', weight: 600, style: 'normal', file: 'UpType - Pulp Display Semi Bold.otf' },
  { name: 'Pulp Display', weight: 800, style: 'normal', file: 'UpType - Pulp Display Extra Bold.otf' },
  { name: 'Literata', weight: 400, style: 'normal', file: 'LiterataBook.otf' },
  { name: 'Literata Greek', weight: 400, style: 'normal', file: 'Literata-Regular.ttf' },
  { name: 'Frank Ruhl Libre', weight: 400, style: 'normal', file: 'FrankRuhlLibre-Regular.ttf' },
]
