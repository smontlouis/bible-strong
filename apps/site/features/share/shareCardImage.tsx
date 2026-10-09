import { Resvg } from '@resvg/resvg-js'
import satori from 'satori'
import { ShareCard, type ShareCardContent } from './ShareCard'
import { loadShareCardFonts } from './shareCardFonts'
import { SHARE_CARD_SIZE } from './shareCardTokens'

/** Draws the share image of a page: the layout engine writes an SVG, which is then rasterised. */
export const renderShareCardPng = async (
  content: ShareCardContent,
  origin: string
): Promise<ArrayBuffer> => {
  const fonts = await loadShareCardFonts(origin)
  const svg = await satori(<ShareCard content={content} />, { ...SHARE_CARD_SIZE, fonts })
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: SHARE_CARD_SIZE.width } })
    .render()
    .asPng()
  // A response body is an ArrayBuffer, not the view Node hands over.
  return png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) as ArrayBuffer
}
