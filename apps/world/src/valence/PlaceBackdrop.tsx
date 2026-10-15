// A place itself, out of focus, behind the characters who speak there: the map's preview
// framed on the station, as the camera shows it. No image of its own to load.
//
// The frame is drawn into a canvas the size of the backdrop. Showing the whole preview several
// times wider than the screen and blurring it made iOS build a layer of about a hundred
// megabytes, enough for Safari to kill the page.
import { useEffect, useRef } from 'react'
import type { Station } from './valence-story'
import { stationAnchors, VALENCE_WIDTH } from './valence-world'

/** How much of the town shows across the backdrop, in map units. */
const PLACE_SPAN = 300
const PREVIEW = './valence-1876/map/preview.webp'

/**
 * The backdrop's CSS frames the place: `--place-top` is where the station stands, as a fraction
 * of the height, and `--place-zoom` how much closer than `PLACE_SPAN` the frame comes.
 */
export function PlaceBackdrop({ station, className }: { station: Station; className: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const element = canvas.current!
    const anchor = stationAnchors[station.id]
    let image: HTMLImageElement | null = null
    let cancelled = false
    function draw() {
      // Hidden (the scene's backdrop on a computer): nothing to load or to draw.
      const width = Math.round(element.clientWidth)
      const height = Math.round(element.clientHeight)
      if (!width || !height) return
      if (!image) {
        image = new Image()
        image.onload = () => !cancelled && draw()
        image.src = PREVIEW
        return
      }
      if (!image.complete || !image.naturalWidth) return
      const style = getComputedStyle(element)
      const top = parseFloat(style.getPropertyValue('--place-top')) || 0.5
      const zoom = parseFloat(style.getPropertyValue('--place-zoom')) || 1
      // One canvas pixel per CSS pixel: the CSS blur hides the rest.
      element.width = width
      element.height = height
      const pixelsPerUnit = image.naturalWidth / VALENCE_WIDTH
      const spanX = PLACE_SPAN / zoom
      const spanY = (spanX * height) / width
      const context = element.getContext('2d')!
      context.fillStyle = '#1c1108'
      context.fillRect(0, 0, width, height)
      // Near the map's edge the frame runs past the preview: only the part inside it is drawn,
      // as older Safari draws nothing from a source rectangle that leaves the image.
      const x = (anchor.x - spanX / 2) * pixelsPerUnit
      const y = (anchor.y - spanY * top) * pixelsPerUnit
      const scale = width / (spanX * pixelsPerUnit)
      const left = Math.max(0, x)
      const upper = Math.max(0, y)
      const right = Math.min(image.naturalWidth, x + spanX * pixelsPerUnit)
      const lower = Math.min(image.naturalHeight, y + spanY * pixelsPerUnit)
      if (right <= left || lower <= upper) return
      context.drawImage(
        image,
        left,
        upper,
        right - left,
        lower - upper,
        (left - x) * scale,
        (upper - y) * scale,
        (right - left) * scale,
        (lower - upper) * scale
      )
    }
    const observer = new ResizeObserver(draw)
    observer.observe(element)
    return () => {
      cancelled = true
      observer.disconnect()
      if (image) image.onload = null
    }
  }, [station.id])
  return (
    <div className={className} aria-hidden="true">
      <canvas ref={canvas} />
    </div>
  )
}
