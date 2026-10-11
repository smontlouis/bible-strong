import {
  shareCardHasPictures,
  SHARE_CARD_SIZE,
  type ShareCardContent,
} from '@bible-strong/share-card-service/content'
import { encode as encodeJpeg } from 'jpeg-js'
import { ShareCard } from './ShareCard'
import { loadShareCardFonts, Resvg, satori, startShareCardEngines } from './shareCardEngines'

export type ShareCardImage = {
  body: ArrayBuffer
  type: 'image/png' | 'image/jpeg'
  /** How long each step took, in milliseconds: what a slow image is made of. */
  timings: { assets: number; layout: number; pixels: number }
}

// A response body is an ArrayBuffer, not the view it is handed as.
const arrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer

/**
 * Draws the share image of a page: the layout engine writes an SVG, which is then rasterised.
 * Flat cards are PNG; a card with photographs would weigh half a megabyte as a PNG and is
 * delivered as a JPEG.
 */
export const renderShareCard = async (
  content: ShareCardContent,
  origin: string
): Promise<ShareCardImage> => {
  const started = performance.now()
  const [fonts] = await Promise.all([loadShareCardFonts(origin), startShareCardEngines()])
  const assetsReady = performance.now()
  const svg = await satori(<ShareCard content={content} />, { ...SHARE_CARD_SIZE, fonts })
  const laidOut = performance.now()
  const rendered = new Resvg(svg, {
    fitTo: { mode: 'width', value: SHARE_CARD_SIZE.width },
  }).render()
  try {
    const picture = shareCardHasPictures(content)
    const body = picture
      ? arrayBuffer(
          encodeJpeg({ data: rendered.pixels, width: rendered.width, height: rendered.height }, 84)
            .data
        )
      : arrayBuffer(rendered.asPng())
    return {
      body,
      type: picture ? 'image/jpeg' : 'image/png',
      timings: {
        assets: assetsReady - started,
        layout: laidOut - assetsReady,
        pixels: performance.now() - laidOut,
      },
    }
  } finally {
    rendered.free()
  }
}
