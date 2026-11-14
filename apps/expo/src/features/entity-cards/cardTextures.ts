import { BlendMode, Skia, TileMode, type SkImage } from '@shopify/react-native-skia'

// The textures of the foils are drawn once on the device, as the atlas draws them in the browser:
// no picture is downloaded for them.

/** A small deterministic generator, so that the sparkles stay where they were between launches. */
const random = (seed: number) => {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const GLITTER_SIZE = 220

let glitter: SkImage | null | undefined

/** White sparkles on black: 700 dots of every brightness, to multiply with a light. */
export const getGlitterTexture = () => {
  if (glitter !== undefined) return glitter
  const surface = Skia.Surface.Make(GLITTER_SIZE, GLITTER_SIZE)
  if (!surface) {
    glitter = null
    return glitter
  }
  const canvas = surface.getCanvas()
  canvas.clear(Skia.Color('#000'))
  const next = random(17)
  const paint = Skia.Paint()
  paint.setAntiAlias(true)
  for (let index = 0; index < 700; index += 1) {
    paint.setColor(Skia.Color(`rgba(255,255,255,${(next() * 0.8 + 0.2).toFixed(2)})`))
    canvas.drawCircle(next() * GLITTER_SIZE, next() * GLITTER_SIZE, next() * 1.3 + 0.3, paint)
  }
  surface.flush()
  glitter = surface.makeImageSnapshot().makeNonTextureImage()
  return glitter
}

export const NEBULA_SIZE = 420

let nebula: SkImage | null | undefined

/** A night of coloured clouds and stars, the ground of the cosmos foil. */
export const getNebulaTexture = () => {
  if (nebula !== undefined) return nebula
  const surface = Skia.Surface.Make(NEBULA_SIZE, NEBULA_SIZE)
  if (!surface) {
    nebula = null
    return nebula
  }
  const canvas = surface.getCanvas()
  canvas.clear(Skia.Color('#05030b'))
  const next = random(29)
  const hues = [280, 300, 190, 220, 320, 260, 170]
  const cloud = Skia.Paint()
  cloud.setBlendMode(BlendMode.Plus)
  for (let index = 0; index < 14; index += 1) {
    const x = next() * NEBULA_SIZE
    const y = next() * NEBULA_SIZE
    const radius = next() * 150 + 60
    cloud.setShader(
      Skia.Shader.MakeRadialGradient(
        { x, y },
        radius,
        [
          Skia.Color(`hsla(${hues[index % hues.length]}, 80%, 60%, 0.32)`),
          Skia.Color('transparent'),
        ],
        null,
        TileMode.Clamp
      )
    )
    canvas.drawRect(Skia.XYWHRect(0, 0, NEBULA_SIZE, NEBULA_SIZE), cloud)
  }
  const star = Skia.Paint()
  for (let index = 0; index < 260; index += 1) {
    star.setColor(Skia.Color(`rgba(255,255,255,${(next() * 0.9).toFixed(2)})`))
    const size = next() < 0.1 ? 2 : 1
    canvas.drawRect(Skia.XYWHRect(next() * NEBULA_SIZE, next() * NEBULA_SIZE, size, size), star)
  }
  surface.flush()
  nebula = surface.makeImageSnapshot().makeNonTextureImage()
  return nebula
}

/**
 * A tile of SVG `feTurbulence type="fractalNoise"` through `feColorMatrix`, as the atlas's grain
 * (`--ac-grain`) and paper (`--ac-paper`): the noise only sets the alpha of one colour.
 */
const noiseTile = (
  size: number,
  frequency: number,
  octaves: number,
  seed: number,
  color: [number, number, number],
  alpha: number
) => {
  const surface = Skia.Surface.Make(size, size)
  if (!surface) return null
  const paint = Skia.Paint()
  paint.setShader(Skia.Shader.MakeFractalNoise(frequency, frequency, octaves, seed, size, size))
  paint.setColorFilter(
    Skia.ColorFilter.MakeMatrix([
      0,
      0,
      0,
      0,
      color[0],
      0,
      0,
      0,
      0,
      color[1],
      0,
      0,
      0,
      0,
      color[2],
      0,
      0,
      0,
      alpha,
      0,
    ])
  )
  surface.getCanvas().drawRect(Skia.XYWHRect(0, 0, size, size), paint)
  surface.flush()
  return surface.makeImageSnapshot().makeNonTextureImage()
}

export const GRAIN_SIZE = 180
export const PAPER_SIZE = 220

let grain: SkImage | null | undefined
let paper: SkImage | null | undefined

/** White noise at 8 %, fine. */
export const getGrainTexture = () => {
  if (grain === undefined) grain = noiseTile(GRAIN_SIZE, 0.85, 2, 0, [1, 1, 1], 0.08)
  return grain
}

/** Brown mottling at 16 %, wide. */
export const getPaperTexture = () => {
  if (paper === undefined) paper = noiseTile(PAPER_SIZE, 0.035, 4, 7, [0.45, 0.33, 0.12], 0.16)
  return paper
}
