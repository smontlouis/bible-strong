import { Resvg } from '@resvg/resvg-js'
import { encode as encodeJpeg } from 'jpeg-js'
import satori from 'satori'
import { ShareCard, shareCardHasPictures, type ShareCardContent } from './ShareCard'
import { loadShareCardFonts } from './shareCardFonts'
import { SHARE_CARD_SIZE } from './shareCardTokens'

export type ShareCardImage = { body: ArrayBuffer; type: 'image/png' | 'image/jpeg' }

// A response body is an ArrayBuffer, not the view Node hands over.
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
  const fonts = await loadShareCardFonts(origin)
  const svg = await satori(<ShareCard content={content} />, { ...SHARE_CARD_SIZE, fonts })
  const rendered = new Resvg(svg, {
    fitTo: { mode: 'width', value: SHARE_CARD_SIZE.width },
  }).render()
  if (!shareCardHasPictures(content)) return { body: arrayBuffer(rendered.asPng()), type: 'image/png' }
  const jpeg = encodeJpeg({ data: rendered.pixels, width: rendered.width, height: rendered.height }, 84)
  return { body: arrayBuffer(jpeg.data), type: 'image/jpeg' }
}
