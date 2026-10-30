import { BIBLICAL_MAP_HEIGHT, BIBLICAL_MAP_WIDTH } from '@bible-strong/resource-domain/biblical-map'
import type { ShareCardContent } from '@bible-strong/share-card-service/content'

type ShareCardMap = NonNullable<Extract<ShareCardContent, { kind: 'entity' }>['map']>

/** The side of the map on the card, in pixels, and of what it shows, in units of the atlas map. */
export const SHARE_MAP_SIZE = 480
const SHARE_MAP_SPAN = 300

// The light colours of the atlas map (`atlas-pages.css`): a share image has one version.
const MAP_COLORS = {
  sea: '#d3e0f8',
  land: '#f8f6ef',
  coast: 'rgba(16, 27, 53, 0.22)',
  water: '#b9cdf3',
  place: '#3f63cf',
  halo: '#ffffff',
} as const

/** The three paths of the ground of the atlas map, read from `public/atlas/map.svg`. */
export type ShareMapGround = { land: string; lakes: string; rivers: string }

export const readShareMapGround = (svg: string): ShareMapGround => {
  const path = (id: string) => new RegExp(`<path id="${id}" d="([^"]*)"`, 'u').exec(svg)?.[1]
  const [land, lakes, rivers] = [path('land'), path('lakes'), path('rivers')]
  if (!land || lakes === undefined || rivers === undefined) {
    throw new Error('SHARE_CARD_MAP_UNREADABLE')
  }
  return { land, lakes, rivers }
}

/** The square of the atlas map a card shows around a place, kept inside the map. */
export const shareMapWindow = (x: number, y: number) => {
  const within = (at: number, size: number) =>
    Math.min(Math.max(at - SHARE_MAP_SPAN / 2, 0), size - SHARE_MAP_SPAN)
  return {
    left: within(x, BIBLICAL_MAP_WIDTH),
    top: within(y, BIBLICAL_MAP_HEIGHT),
    span: SHARE_MAP_SPAN,
  }
}

/** Where a point of the atlas map falls on the card's map, in pixels. */
export const shareMapPixel = (window: ReturnType<typeof shareMapWindow>, x: number, y: number) => ({
  left: ((x - window.left) / window.span) * SHARE_MAP_SIZE,
  top: ((y - window.top) / window.span) * SHARE_MAP_SIZE,
})

/**
 * The map of a place as an SVG: the ground around it, its neighbours as dots and the place
 * itself marked. Names are not drawn here: the renderer of the SVG has no fonts, the card lays
 * them over the picture.
 */
export const shareMapSvg = (ground: ShareMapGround, map: ShareCardMap): string => {
  const window = shareMapWindow(map.x, map.y)
  const unit = window.span / SHARE_MAP_SIZE
  const dots = map.neighbours
    .map(
      ([, x, y]) =>
        `<circle cx="${x}" cy="${y}" r="${5 * unit}" fill="${MAP_COLORS.place}" stroke="${MAP_COLORS.halo}" stroke-width="${2 * unit}"/>`
    )
    .join('')
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SHARE_MAP_SIZE}" height="${SHARE_MAP_SIZE}" viewBox="${window.left} ${window.top} ${window.span} ${window.span}">`,
    `<rect x="${window.left}" y="${window.top}" width="${window.span}" height="${window.span}" fill="${MAP_COLORS.sea}"/>`,
    `<path d="${ground.land}" fill="${MAP_COLORS.land}" stroke="${MAP_COLORS.coast}" stroke-width="${1.5 * unit}"/>`,
    `<path d="${ground.lakes}" fill="${MAP_COLORS.water}"/>`,
    `<path d="${ground.rivers}" fill="none" stroke="${MAP_COLORS.water}" stroke-width="${2.5 * unit}" stroke-linecap="round" stroke-linejoin="round"/>`,
    dots,
    `<circle cx="${map.x}" cy="${map.y}" r="${30 * unit}" fill="${MAP_COLORS.place}" fill-opacity="0.16"/>`,
    `<circle cx="${map.x}" cy="${map.y}" r="${11 * unit}" fill="${MAP_COLORS.place}" stroke="${MAP_COLORS.halo}" stroke-width="${4 * unit}"/>`,
    '</svg>',
  ].join('')
}
