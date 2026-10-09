import {
  shareCardHasPictures,
  SHARE_CARD_SIZE,
  type ShareCardContent,
} from '@bible-strong/share-card-service/content'
import { initWasm, Resvg } from '@resvg/resvg-wasm'
import { encode as encodeJpeg } from 'jpeg-js'
import satori from 'satori'
import { ShareCard } from './ShareCard'
import { loadShareCardFonts } from './shareCardFonts'

export type ShareCardImage = { body: ArrayBuffer; type: 'image/png' | 'image/jpeg' }

// A response body is an ArrayBuffer, not the view it is handed as.
const arrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer

let rasteriser: Promise<void> | undefined

/**
 * The rasteriser is WebAssembly, the same on every machine, and is read once per instance
 * from the site's own `/wasm/` folder like the fonts: nothing of it has to be bundled with
 * the function, which a native build would need.
 */
const loadRasteriser = (origin: string): Promise<void> => {
  rasteriser ??= initWasm(fetch(new URL('/wasm/resvg.wasm', origin))).catch(cause => {
    rasteriser = undefined
    throw cause
  })
  return rasteriser
}

/**
 * Draws the share image of a page: the layout engine writes an SVG, which is then rasterised.
 * Flat cards are PNG; a card with photographs would weigh half a megabyte as a PNG and is
 * delivered as a JPEG.
 */
export const renderShareCard = async (
  content: ShareCardContent,
  origin: string
): Promise<ShareCardImage> => {
  const [fonts] = await Promise.all([loadShareCardFonts(origin), loadRasteriser(origin)])
  const svg = await satori(<ShareCard content={content} />, { ...SHARE_CARD_SIZE, fonts })
  const rendered = new Resvg(svg, {
    fitTo: { mode: 'width', value: SHARE_CARD_SIZE.width },
  }).render()
  try {
    if (!shareCardHasPictures(content)) {
      return { body: arrayBuffer(rendered.asPng()), type: 'image/png' }
    }
    const jpeg = encodeJpeg(
      { data: rendered.pixels, width: rendered.width, height: rendered.height },
      84
    )
    return { body: arrayBuffer(jpeg.data), type: 'image/jpeg' }
  } finally {
    rendered.free()
  }
}
