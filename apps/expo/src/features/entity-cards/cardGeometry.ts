// Geometry shared by the card's layers: the CSS of the public atlas (apps/site/src/atlas-cards.css)
// measures everything in hundredths of the card's width (`cqw`), and so does this port.

/** A card is 63 by 88, like a playing card. */
export const CARD_RATIO = 88 / 63

/** The image covers the top of the card, 104 hundredths of its width high. */
export const ART_HEIGHT = 104

/** Where the light stands when nothing moves the card: a little above its middle. */
export const REST = { x: 50, y: 32, shine: 0.75 }

export const clamp = (value: number, min = 0, max = 100) => {
  'worklet'
  return Math.min(Math.max(value, min), max)
}

export type Point = { x: number; y: number }

/**
 * The two ends of a CSS `linear-gradient(<angle>deg, …)` drawn over a box: the line goes through
 * its centre and is long enough for the corners to take the first and last colours.
 */
export const cssLinearEnds = (
  angle: number,
  x: number,
  y: number,
  width: number,
  height: number
) => {
  'worklet'
  const radians = (angle * Math.PI) / 180
  const dx = Math.sin(radians)
  const dy = -Math.cos(radians)
  const half = (Math.abs(width * dx) + Math.abs(height * dy)) / 2
  const cx = x + width / 2
  const cy = y + height / 2
  return {
    start: { x: cx - dx * half, y: cy - dy * half },
    end: { x: cx + dx * half, y: cy + dy * half },
  }
}

/** The radius of a `farthest-corner` circle at a point of a box. */
export const farthestCorner = (px: number, py: number, width: number, height: number) => {
  'worklet'
  const fx = Math.max(px, width - px)
  const fy = Math.max(py, height - py)
  return Math.sqrt(fx * fx + fy * fy)
}

/**
 * CSS stops that run backwards or out of the line are pulled forward, as a browser does: a stop
 * before the one ahead of it stands on it.
 */
export const cssStops = (positions: number[]) => {
  'worklet'
  let last = 0
  return positions.map(position => {
    last = Math.max(last, Math.min(Math.max(position, 0), 1))
    return last
  })
}

/** The foil of a card's lettering and ring: dark, light, a gleam at the light, light, dark. */
export const foilStops = (pointerX: number) => {
  'worklet'
  const p = pointerX / 100
  return cssStops([0, p - 0.26, p, p + 0.26, 1])
}

/** `object-fit: cover` with an `object-position` in a box. */
export const coverRect = (
  imageWidth: number,
  imageHeight: number,
  box: { x: number; y: number; width: number; height: number },
  positionX = 0.5,
  positionY = 0.5
) => {
  const scale = Math.max(box.width / imageWidth, box.height / imageHeight)
  const width = imageWidth * scale
  const height = imageHeight * scale
  return {
    x: box.x + (box.width - width) * positionX,
    y: box.y + (box.height - height) * positionY,
    width,
    height,
  }
}

/** `adjust` of the atlas: a value of one range carried to another. */
export const adjust = (
  value: number,
  fromMin: number,
  fromMax: number,
  toMin: number,
  toMax: number
) => {
  'worklet'
  return toMin + ((toMax - toMin) * (value - fromMin)) / (fromMax - fromMin)
}

/**
 * A CSS `repeating-linear-gradient` over a box: the colours run from the first stop to the last
 * and repeat beyond, which a gradient in `repeat` mode does between these two ends.
 */
export const cssRepeatingEnds = (
  angle: number,
  x: number,
  y: number,
  width: number,
  height: number,
  first: number,
  last: number
) => {
  'worklet'
  const { start, end } = cssLinearEnds(angle, x, y, width, height)
  const dx = end.x - start.x
  const dy = end.y - start.y
  return {
    start: { x: start.x + dx * first, y: start.y + dy * first },
    end: { x: start.x + dx * last, y: start.y + dy * last },
  }
}

/** The stops of a repeating gradient, from its first to its last, as shares of that run. */
export const repeatingPositions = (stops: number[]) => {
  const first = stops[0]
  const last = stops[stops.length - 1]
  return stops.map(stop => (stop - first) / (last - first))
}

type Matrix = number[]

/** The 4×5 colour matrix of CSS `filter: brightness() contrast() saturate()`, in that order. */
export const cssFilterMatrix = ({
  brightness = 1,
  contrast = 1,
  saturate = 1,
}: {
  brightness?: number
  contrast?: number
  saturate?: number
}): Matrix => {
  const b: Matrix = [
    brightness,
    0,
    0,
    0,
    0,
    0,
    brightness,
    0,
    0,
    0,
    0,
    0,
    brightness,
    0,
    0,
    0,
    0,
    0,
    1,
    0,
  ]
  const offset = 0.5 - 0.5 * contrast
  const c: Matrix = [
    contrast,
    0,
    0,
    0,
    offset,
    0,
    contrast,
    0,
    0,
    offset,
    0,
    0,
    contrast,
    0,
    offset,
    0,
    0,
    0,
    1,
    0,
  ]
  const s = saturate
  const sat: Matrix = [
    0.213 + 0.787 * s,
    0.715 - 0.715 * s,
    0.072 - 0.072 * s,
    0,
    0,
    0.213 - 0.213 * s,
    0.715 + 0.285 * s,
    0.072 - 0.072 * s,
    0,
    0,
    0.213 - 0.213 * s,
    0.715 - 0.715 * s,
    0.072 + 0.928 * s,
    0,
    0,
    0,
    0,
    0,
    1,
    0,
  ]
  return multiplyColorMatrices(sat, multiplyColorMatrices(c, b))
}

/** `a · b`: the colour matrix that applies b, then a. */
const multiplyColorMatrices = (a: Matrix, b: Matrix): Matrix => {
  const result: Matrix = []
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 5; column += 1) {
      let value = column === 4 ? a[row * 5 + 4] : 0
      for (let k = 0; k < 4; k += 1) value += a[row * 5 + k] * b[k * 5 + column]
      result.push(value)
    }
  }
  return result
}
