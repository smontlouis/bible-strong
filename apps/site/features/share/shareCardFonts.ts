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

const FILES: readonly (Omit<ShareCardFont, 'data'> & { file: string })[] = [
  { name: 'Pulp Display', weight: 500, style: 'normal', file: 'UpType - Pulp Display Medium.otf' },
  { name: 'Pulp Display', weight: 600, style: 'normal', file: 'UpType - Pulp Display Semi Bold.otf' },
  { name: 'Pulp Display', weight: 800, style: 'normal', file: 'UpType - Pulp Display Extra Bold.otf' },
  { name: 'Literata', weight: 400, style: 'normal', file: 'LiterataBook.otf' },
  { name: 'Literata Greek', weight: 400, style: 'normal', file: 'Literata-Regular.ttf' },
  { name: 'Frank Ruhl Libre', weight: 400, style: 'normal', file: 'FrankRuhlLibre-Regular.ttf' },
]

let loaded: Promise<ShareCardFont[]> | undefined

/**
 * The fonts of the cards, read once per instance from the site's own `/fonts/` folder: a
 * function does not have the public files on its disk, but it can ask its own origin for them.
 */
export const loadShareCardFonts = (origin: string): Promise<ShareCardFont[]> => {
  loaded ??= Promise.all(
    FILES.map(async ({ file, ...font }) => {
      const response = await fetch(new URL(`/fonts/${encodeURIComponent(file)}`, origin))
      if (!response.ok) throw new Error(`SHARE_CARD_FONT_UNAVAILABLE: ${file}`)
      return { ...font, data: await response.arrayBuffer() }
    })
  ).catch(cause => {
    // A failed read is not kept: the next image asks again.
    loaded = undefined
    throw cause
  })
  return loaded
}
