import {
  shareCardHasPictures,
  SHARE_CARD_SIZE,
  type ShareCardContent,
} from '@bible-strong/share-card-service/content'
import { encode as encodeJpeg } from 'jpeg-js'
import { ShareCard } from './ShareCard'
import {
  loadShareCardFonts,
  readSiteFile,
  Resvg,
  satori,
  startShareCardEngines,
} from './shareCardEngines'
import { readShareMapGround, shareMapSvg, type ShareMapGround } from './shareCardMap'

export type ShareCardImage = {
  body: ArrayBuffer
  type: 'image/png' | 'image/jpeg'
  /** How long each step took, in milliseconds: what a slow image is made of. */
  timings: { assets: number; layout: number; pixels: number }
}

// A response body is an ArrayBuffer, not the view it is handed as.
const arrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer

const base64 = (bytes: Uint8Array): string => {
  let binary = ''
  for (let at = 0; at < bytes.length; at += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000))
  }
  return btoa(binary)
}

let ground: Promise<ShareMapGround> | undefined

// The ground of the atlas map, read once per instance; a failed read is not kept.
const loadMapGround = (origin: string): Promise<ShareMapGround> => {
  ground ??= readSiteFile(origin, '/atlas/map.svg')
    .then(async response => readShareMapGround(await response.text()))
    .catch(cause => {
      ground = undefined
      throw cause
    })
  return ground
}

/**
 * A picture of a card, read before the layout and handed to it whole. The layout engine would
 * read an address by itself, but it draws a picture it could not read as nothing, and the share
 * card service would keep that card for good: read here, a missing picture fails the image, which
 * the service does not keep. A picture of the site itself is read through the Worker's binding;
 * another, past any cached answer, which may still be the absence of a picture just published.
 */
const readPicture = async (address: string, origin: string): Promise<string> => {
  const response = address.startsWith('/')
    ? await readSiteFile(origin, address)
    : await fetch(address, { cache: 'no-store' })
  const type = response.headers.get('content-type') ?? ''
  if (!response.ok || !/^image\/(?:png|jpeg)$/u.test(type)) {
    throw new Error(`SHARE_CARD_PICTURE_UNAVAILABLE: ${response.status} ${type} ${address}`)
  }
  return `data:${type};base64,${base64(new Uint8Array(await response.arrayBuffer()))}`
}

/** The card with its pictures read, and the drawing of the map an entity card shows. */
const prepare = async (
  content: ShareCardContent,
  origin: string
): Promise<{ content: ShareCardContent; map?: string }> => {
  if (content.kind === 'title') {
    const [picture, pictures] = await Promise.all([
      content.picture ? readPicture(content.picture, origin) : undefined,
      content.pictures
        ? Promise.all(
            content.pictures.map(async item => ({
              ...item,
              src: await readPicture(item.src, origin),
            }))
          )
        : undefined,
    ])
    return {
      content: { ...content, ...(picture ? { picture } : {}), ...(pictures ? { pictures } : {}) },
    }
  }
  if (content.kind !== 'entity') return { content }
  const [picture, map] = await Promise.all([
    content.picture ? readPicture(content.picture, origin) : undefined,
    content.map
      ? loadMapGround(origin).then(
          ground =>
            `data:image/svg+xml;base64,${base64(new TextEncoder().encode(shareMapSvg(ground, content.map!)))}`
        )
      : undefined,
  ])
  return { content: { ...content, ...(picture ? { picture } : {}) }, map }
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
  const [fonts, prepared] = await Promise.all([
    loadShareCardFonts(origin),
    prepare(content, origin),
    startShareCardEngines(),
  ])
  const assetsReady = performance.now()
  const svg = await satori(<ShareCard content={prepared.content} map={prepared.map} />, {
    ...SHARE_CARD_SIZE,
    fonts,
  })
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
