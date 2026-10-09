import {
  shareCardHasPictures,
  SHARE_CARD_SIZE,
  type ShareCardContent,
} from '@bible-strong/share-card-service/content'
import { initWasm, Resvg as PortableResvg } from '@resvg/resvg-wasm'
import { encode as encodeJpeg } from 'jpeg-js'
import satori from 'satori'
import { ShareCard } from './ShareCard'
import { loadShareCardFonts } from './shareCardFonts'

export type ShareCardImage = {
  body: ArrayBuffer
  type: 'image/png' | 'image/jpeg'
  /** How long each step took, in milliseconds: what a slow image is made of. */
  timings: { assets: number; layout: number; pixels: number }
  /** Which rasteriser drew it. */
  engine: 'native' | 'portable'
}

// A response body is an ArrayBuffer, not the view it is handed as.
const arrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer

type Rasteriser = {
  engine: 'native' | 'portable'
  Resvg: new (
    svg: string,
    options: { fitTo: { mode: 'width'; value: number } }
  ) => {
    render(): {
      asPng(): Uint8Array
      pixels: Uint8Array
      width: number
      height: number
      free?: () => void
    }
  }
}

let rasteriser: Promise<Rasteriser> | undefined

/**
 * The native rasteriser draws several times faster, but it is a binary built for one kind of
 * machine, which the function may or may not carry. When it cannot be loaded, the same
 * rasteriser as WebAssembly is read from the site's own `/wasm/` folder, like the fonts.
 */
const loadRasteriser = (origin: string): Promise<Rasteriser> => {
  rasteriser ??= import('@resvg/resvg-js')
    .then(({ Resvg }): Rasteriser => ({ engine: 'native', Resvg }))
    .catch(async (): Promise<Rasteriser> => {
      await initWasm(fetch(new URL('/wasm/resvg.wasm', origin)))
      return { engine: 'portable', Resvg: PortableResvg }
    })
    .catch(cause => {
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
  const started = performance.now()
  const [fonts, { engine, Resvg }] = await Promise.all([
    loadShareCardFonts(origin),
    loadRasteriser(origin),
  ])
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
      engine,
      timings: {
        assets: assetsReady - started,
        layout: laidOut - assetsReady,
        pixels: performance.now() - laidOut,
      },
    }
  } finally {
    rendered.free?.()
  }
}
