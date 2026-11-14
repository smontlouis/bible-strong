import {
  ColorMatrix,
  Group,
  ImageShader,
  LinearGradient,
  Paint,
  RadialGradient,
  Rect,
} from '@shopify/react-native-skia'
import { useDerivedValue } from 'react-native-reanimated'

import type { CardFinish } from './cardCatalog'
import {
  cssFilterMatrix,
  cssLinearEnds,
  cssRepeatingEnds,
  farthestCorner,
  repeatingPositions,
} from './cardGeometry'
import type { CardMotion } from './cardMotion'
import {
  GLITTER_SIZE,
  NEBULA_SIZE,
  getGlitterTexture,
  getGrainTexture,
  getNebulaTexture,
} from './cardTextures'

// The foils of the cards, layer for layer as `.ac-fin-*` in apps/site/src/atlas-cards.css. A CSS
// element with `mix-blend-mode` and `filter` is a Skia layer with that blend and a colour matrix;
// its `background-blend-mode` is the blend of each background drawn over the ones below it; its
// pseudo-elements are layers inside it.

type Box = { width: number; height: number; motion: CardMotion }

/** CSS interpolates gradients between premultiplied colours; Skia does when told. */
export const PREMUL = 1

/** The fine grain of the atlas (`--ac-grain`), tiled. */
export const Grain = ({
  x = 0,
  y = 0,
  width,
  height,
  blendMode,
}: {
  x?: number
  y?: number
  width: number
  height: number
  blendMode?: 'screen'
}) => (
  <Rect x={x} y={y} width={width} height={height} blendMode={blendMode}>
    <ImageShader image={getGrainTexture()} tx="repeat" ty="repeat" />
  </Rect>
)

// ---------- Glitter: the humans, and the frame of the spiritual beings ----------

/** Sparkles lit by a band of rainbow that follows the light (`.ac-fin-glitter .ac-fr-shine`). */
const GlitterFrame = ({ width, height, motion }: Box) => {
  const glitter = getGlitterTexture()
  const ends = cssLinearEnds(115, 0, 0, width, height)
  const positions = useDerivedValue(() => {
    const p = motion.pointerX.get() / 100
    return [0, Math.max(0, p - 0.12), p, Math.min(1, p + 0.18), 1]
  })
  const opacity = useDerivedValue(() => 0.12 + motion.shine.get() * 0.4)
  const tile = 0.18 * width
  return (
    <Group layer={<Paint blendMode="colorDodge" opacity={opacity} />}>
      <Rect x={0} y={0} width={width} height={height}>
        <LinearGradient
          start={ends.start}
          end={ends.end}
          colors={['#ff4fd8', '#5ef0ff', '#fff36b', '#8a5bff', '#ff4fd8']}
          positions={positions}
        />
      </Rect>
      <Rect x={0} y={0} width={width} height={height} blendMode="multiply">
        <ImageShader
          image={glitter}
          tx="repeat"
          ty="repeat"
          transform={[{ scale: tile / GLITTER_SIZE }]}
        />
      </Rect>
    </Group>
  )
}

/** Sparkles that catch the light around it (`.ac-fin-glitter .ac-shine-art`). */
const GlitterArt = ({ width, height, motion }: Box) => {
  const glitter = getGlitterTexture()
  const light = useDerivedValue(() => ({
    x: (motion.pointerX.get() / 100) * width,
    y: (motion.pointerY.get() / 100) * height,
  }))
  const radius = useDerivedValue(() => farthestCorner(light.get().x, light.get().y, width, height))
  const opacity = useDerivedValue(() => 0.25 + motion.shine.get() * 0.75)
  const tile = 0.14 * width
  const transform = useDerivedValue(() => [
    { translateX: (width - tile) * (0.5 - motion.tx.get() * 0.06) },
    { translateY: (height - tile) * (0.5 - motion.ty.get() * 0.06) },
    { scale: tile / GLITTER_SIZE },
  ])
  return (
    <Group layer={<Paint blendMode="colorDodge" opacity={opacity} />}>
      <Rect x={0} y={0} width={width} height={height}>
        <RadialGradient
          c={light}
          r={radius}
          colors={['#fff', '#777', '#000']}
          positions={[0, 0.3, 0.75]}
        />
      </Rect>
      <Rect x={0} y={0} width={width} height={height} blendMode="multiply">
        <ImageShader image={glitter} tx="repeat" ty="repeat" transform={transform} />
      </Rect>
    </Group>
  )
}

// ---------- Reverse holo: the frame of God, Jesus and the gods ----------

const REVERSE_FILTER = cssFilterMatrix({ brightness: 0.55, contrast: 1.5 })

/** A gleam that sweeps the frame and dies at the middle (`.ac-fin-reverse .ac-fr-shine`). */
const ReverseFrame = ({ width, height, motion }: Box) => {
  const glitter = getGlitterTexture()
  const tile = 0.22 * width
  const opacity = useDerivedValue(() =>
    Math.min(1, Math.max(0, 1.5 * motion.shine.get() - motion.fromCenter.get()))
  )
  // linear-gradient(-45deg) over a plate twice the card, moved with the light.
  const sweep = useDerivedValue(() =>
    cssLinearEnds(
      -45,
      -width * (motion.pointerX.get() / 100),
      -height * (motion.pointerY.get() / 100),
      2 * width,
      2 * height
    )
  )
  const sweepStart = useDerivedValue(() => sweep.get().start)
  const sweepEnd = useDerivedValue(() => sweep.get().end)
  // radial-gradient(circle at the light) over a plate of 120 %, centred.
  const ring = useDerivedValue(() => {
    const x = -0.1 * width + 1.2 * width * (motion.pointerX.get() / 100)
    const y = -0.1 * height + 1.2 * height * (motion.pointerY.get() / 100)
    return { x, y }
  })
  const ringRadius = useDerivedValue(() =>
    farthestCorner(
      ring.get().x + 0.1 * width,
      ring.get().y + 0.1 * height,
      1.2 * width,
      1.2 * height
    )
  )
  return (
    <Group
      layer={
        <Paint blendMode="colorDodge" opacity={opacity}>
          <ColorMatrix matrix={REVERSE_FILTER} />
        </Paint>
      }
    >
      <Rect x={0} y={0} width={width} height={height}>
        <ImageShader
          image={glitter}
          tx="repeat"
          ty="repeat"
          transform={[
            { translateX: (width - tile) / 2 },
            { translateY: (height - tile) / 2 },
            { scale: tile / GLITTER_SIZE },
          ]}
        />
      </Rect>
      <Rect x={0} y={0} width={width} height={height} blendMode="difference">
        <LinearGradient
          start={sweepStart}
          end={sweepEnd}
          colors={['#000', '#fff', '#000']}
          positions={[0.15, 0.5, 0.85]}
        />
      </Rect>
      <Rect x={0} y={0} width={width} height={height} blendMode="softLight">
        <RadialGradient
          c={ring}
          r={ringRadius}
          colors={['#fff', '#000', '#fff']}
          positions={[0.05, 0.5, 0.8]}
        />
      </Rect>
    </Group>
  )
}

// ---------- Holo: behind God and Jesus ----------

const HOLO = ['#c929f1', '#0dbde9', '#21e985', '#eedf10', '#f80e35']
const HOLO_COLORS = [...HOLO, ...HOLO, ...HOLO]
const HOLO_FILTER = cssFilterMatrix({ brightness: 1.1, contrast: 1.1, saturate: 1.2 })
const BARS_FILTER = cssFilterMatrix({ brightness: 1.15, contrast: 1.1 })
const SHEEN_FILTER = cssFilterMatrix({ brightness: 0.6, contrast: 4 })
// --bars: 3 %; the stops of the two bar patterns, in hundredths of their plate.
const BARS_COLORS = ['#000', '#b3b3b3', '#000', '#b3b3b3', '#000', '#000']
const BARS_A = [6, 9, 10.5, 12, 15, 42]
const BARS_B = [6, 9, 10.5, 12, 15, 30]

/** A bar pattern on a plate twice the image, placed at a share of the room it has to move. */
const barsEnds = (stops: number[], width: number, height: number, position: number) => {
  'worklet'
  return cssRepeatingEnds(
    90,
    -width * position,
    0,
    2 * width,
    2 * height,
    stops[0] / 100,
    stops[stops.length - 1] / 100
  )
}

/** Rainbow holo over fine lines, with bars and a sheen (`.ac-fin-holo-reverse .ac-shine-art`). */
const HoloArt = ({ width, height, motion }: Box) => {
  const opacity = useDerivedValue(() => 0.14 + motion.shine.get() * 0.66)
  // The rainbow on a plate four times the image, moved against the light.
  const holo = useDerivedValue(() => {
    const px = ((50 - motion.backgroundX.get()) * 2.6 + 50) / 100
    const py = ((50 - motion.backgroundY.get()) * 3.5 + 50) / 100
    return cssLinearEnds(110, -3 * width * px, -3 * height * py, 4 * width, 4 * height)
  })
  const holoStart = useDerivedValue(() => holo.get().start)
  const holoEnd = useDerivedValue(() => holo.get().end)
  const barsA = useDerivedValue(() =>
    barsEnds(
      BARS_A,
      width,
      height,
      ((50 - motion.backgroundX.get()) * 1.65 + 50 + motion.backgroundY.get() * 0.5) / 100
    )
  )
  const barsB = useDerivedValue(() =>
    barsEnds(
      BARS_B,
      width,
      height,
      ((50 - motion.backgroundX.get()) * -0.9 + 50 - motion.backgroundY.get() * 0.75) / 100
    )
  )
  const barsAStart = useDerivedValue(() => barsA.get().start)
  const barsAEnd = useDerivedValue(() => barsA.get().end)
  const barsBStart = useDerivedValue(() => barsB.get().start)
  const barsBEnd = useDerivedValue(() => barsB.get().end)
  const light = useDerivedValue(() => ({
    x: (motion.pointerX.get() / 100) * width,
    y: (motion.pointerY.get() / 100) * height,
  }))
  const radius = useDerivedValue(() => farthestCorner(light.get().x, light.get().y, width, height))
  return (
    <Group
      layer={
        <Paint blendMode="colorDodge" opacity={opacity}>
          <ColorMatrix matrix={HOLO_FILTER} />
        </Paint>
      }
    >
      {/* repeating-linear-gradient(90deg, #000 0 1px, #666 1px 2px) */}
      <Rect x={0} y={0} width={width} height={height}>
        <LinearGradient
          start={{ x: 0, y: 0 }}
          end={{ x: 2, y: 0 }}
          colors={['#000', '#000', '#666', '#666']}
          positions={[0, 0.5, 0.5, 1]}
          mode="repeat"
        />
      </Rect>
      <Rect x={0} y={0} width={width} height={height} blendMode="overlay">
        <LinearGradient start={holoStart} end={holoEnd} colors={HOLO_COLORS} />
      </Rect>
      <Group
        layer={
          <Paint blendMode="hardLight">
            <ColorMatrix matrix={BARS_FILTER} />
          </Paint>
        }
      >
        <Rect x={0} y={0} width={width} height={height}>
          <LinearGradient
            start={barsBStart}
            end={barsBEnd}
            colors={BARS_COLORS}
            positions={repeatingPositions(BARS_B)}
            mode="repeat"
          />
        </Rect>
        <Rect x={0} y={0} width={width} height={height} blendMode="screen">
          <LinearGradient
            start={barsAStart}
            end={barsAEnd}
            colors={BARS_COLORS}
            positions={repeatingPositions(BARS_A)}
            mode="repeat"
          />
        </Rect>
      </Group>
      <Group
        layer={
          <Paint blendMode="luminosity">
            <ColorMatrix matrix={SHEEN_FILTER} />
          </Paint>
        }
      >
        <Rect x={0} y={0} width={width} height={height}>
          <RadialGradient
            c={light}
            r={radius}
            colors={['hsla(0, 0%, 90%, 0.8)', 'hsla(0, 0%, 78%, 0.1)', '#000']}
            positions={[0, 0.25, 0.9]}
            flags={PREMUL}
          />
        </Rect>
      </Group>
    </Group>
  )
}

// ---------- Cosmos: the spiritual beings ----------

const COSMOS = [
  'hsl(53, 65%, 60%)',
  'hsl(93, 56%, 50%)',
  'hsl(176, 54%, 49%)',
  'hsl(228, 59%, 55%)',
  'hsl(283, 60%, 55%)',
  'hsl(326, 59%, 51%)',
  'hsl(326, 59%, 51%)',
  'hsl(283, 60%, 55%)',
  'hsl(228, 59%, 55%)',
  'hsl(176, 54%, 49%)',
  'hsl(93, 56%, 50%)',
  'hsl(53, 65%, 60%)',
]
const COSMOS_STOPS = COSMOS.map((_, index) => 4 * (index + 1))
const COSMOS_FILTER = cssFilterMatrix({ saturate: 0.8 })
// The halo stops at 130 %: its colour at the corner is two thirds of the way to black.
const COSMOS_HALO = [
  'hsla(180, 100%, 89%, 0.5)',
  'hsla(180, 14%, 57%, 0.3)',
  'rgba(16, 24, 24, 0.77)',
]

/** A nebula through a rainbow, with sparkles (`.ac-fin-cosmos .ac-shine-art`). */
const CosmosArt = ({ width, height, motion }: Box) => {
  const nebula = getNebulaTexture()
  const glitter = getGlitterTexture()
  const opacity = useDerivedValue(() => 0.35 + motion.shine.get() * 0.6)
  const sparkleOpacity = useDerivedValue(() => 0.2 + motion.shine.get() * 0.7)
  const light = useDerivedValue(() => ({
    x: (motion.pointerX.get() / 100) * width,
    y: (motion.pointerY.get() / 100) * height,
  }))
  const radius = useDerivedValue(() => farthestCorner(light.get().x, light.get().y, width, height))
  // The rainbow on a plate of 400 % by 900 %, moved with the light.
  const rainbow = useDerivedValue(() => {
    const px = 0.1 + (motion.pointerX.get() / 100) * 0.8
    const py = 0.1 + (motion.pointerY.get() / 100) * 0.8
    return cssRepeatingEnds(
      82,
      -3 * width * px,
      -8 * height * py,
      4 * width,
      9 * height,
      COSMOS_STOPS[0] / 100,
      COSMOS_STOPS[COSMOS_STOPS.length - 1] / 100
    )
  })
  const rainbowStart = useDerivedValue(() => rainbow.get().start)
  const rainbowEnd = useDerivedValue(() => rainbow.get().end)
  const side = Math.max(width, height)
  const nebulaTransform = useDerivedValue(() => [
    { translateX: (width - side) * (0.5 + motion.tx.get() * 0.06) },
    { translateY: (height - side) * (0.5 + motion.ty.get() * 0.06) },
    { scale: side / NEBULA_SIZE },
  ])
  const tile = 0.16 * width
  const sparkles = useDerivedValue(() => [
    { translateX: (width - tile) * (0.5 - motion.tx.get() * 0.08) },
    { translateY: (height - tile) * (0.5 - motion.ty.get() * 0.08) },
    { scale: tile / GLITTER_SIZE },
  ])
  return (
    <Group
      layer={
        <Paint blendMode="colorDodge" opacity={opacity}>
          <ColorMatrix matrix={COSMOS_FILTER} />
        </Paint>
      }
    >
      <Rect x={0} y={0} width={width} height={height}>
        <RadialGradient
          c={light}
          r={radius}
          colors={COSMOS_HALO}
          positions={[0.05, 0.4, 1]}
          flags={PREMUL}
        />
      </Rect>
      <Rect x={0} y={0} width={width} height={height} blendMode="multiply">
        <LinearGradient
          start={rainbowStart}
          end={rainbowEnd}
          colors={COSMOS}
          positions={repeatingPositions(COSMOS_STOPS)}
          mode="repeat"
        />
      </Rect>
      <Rect x={0} y={0} width={width} height={height} blendMode="colorBurn">
        <ImageShader image={nebula} tx="clamp" ty="clamp" transform={nebulaTransform} />
      </Rect>
      <Group layer={<Paint blendMode="colorDodge" opacity={sparkleOpacity} />}>
        <Rect x={0} y={0} width={width} height={height}>
          <ImageShader image={glitter} tx="repeat" ty="repeat" transform={sparkles} />
        </Rect>
      </Group>
    </Group>
  )
}

// ---------- V: the humans with life stages ----------

const V_PASTELS = [
  'hsl(2, 100%, 73%)',
  'hsl(53, 100%, 69%)',
  'hsl(93, 100%, 69%)',
  'hsl(176, 100%, 76%)',
  'hsl(228, 100%, 74%)',
  'hsl(283, 100%, 73%)',
]
const V_BANDS = [...V_PASTELS, V_PASTELS[0]]
/** The second layer runs the colours one step on. */
const V_BANDS_AFTER = [V_PASTELS[5], ...V_PASTELS]
const V_BAND_STOPS = [5, 10, 15, 20, 25, 30, 35]
const V_LINES = [
  '#0e152e',
  'hsl(180, 10%, 60%)',
  'hsl(180, 29%, 66%)',
  'hsl(180, 10%, 60%)',
  '#0e152e',
  '#0e152e',
]
const V_LINE_STOPS = [0, 3.8, 4.5, 5.2, 10, 12]
const V_FILTER = cssFilterMatrix({ brightness: 1, contrast: 1.7, saturate: 0.9 })
const V_FILTER_AFTER = cssFilterMatrix({ brightness: 1.2, contrast: 2, saturate: 1.75 })

/** One layer of pastel bands over lines; `after` is the second one, on the image only. */
const VBackgrounds = ({ width, height, motion, after }: Box & { after: boolean }) => {
  // radial-gradient at the light, on a plate twice as wide, moved with the light.
  const shade = useDerivedValue(() => {
    const x = (width - 2 * width) * (motion.backgroundX.get() / 100)
    return {
      c: {
        x: x + 2 * width * (motion.pointerX.get() / 100),
        y: height * (motion.pointerY.get() / 100),
      },
      x,
    }
  })
  const shadeCenter = useDerivedValue(() => shade.get().c)
  const shadeRadius = useDerivedValue(() =>
    farthestCorner(shade.get().c.x - shade.get().x, shade.get().c.y, 2 * width, height)
  )
  // repeating-linear-gradient(133deg) of fine lines.
  const lines = useDerivedValue(() => {
    const bx = motion.backgroundX.get() / 100
    const plate = after ? 1.95 * width : 3 * width
    const x = after ? (width - plate) * -bx : (width - plate) * bx
    return cssRepeatingEnds(
      133,
      x,
      0,
      plate,
      height,
      V_LINE_STOPS[0] / 100,
      V_LINE_STOPS[V_LINE_STOPS.length - 1] / 100
    )
  })
  const linesStart = useDerivedValue(() => lines.get().start)
  const linesEnd = useDerivedValue(() => lines.get().end)
  // repeating-linear-gradient(0deg) of pastel bands, climbing as the card tilts.
  const bands = useDerivedValue(() => {
    const plate = (after ? 4 : 7) * height
    const y = (height - plate) * (motion.backgroundY.get() / 100)
    return cssRepeatingEnds(
      0,
      0,
      y,
      2 * width,
      plate,
      V_BAND_STOPS[0] / 100,
      V_BAND_STOPS[V_BAND_STOPS.length - 1] / 100
    )
  })
  const bandsStart = useDerivedValue(() => bands.get().start)
  const bandsEnd = useDerivedValue(() => bands.get().end)
  return (
    <>
      <Rect x={0} y={0} width={width} height={height}>
        <RadialGradient
          c={shadeCenter}
          r={shadeRadius}
          colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.233)']}
          positions={[0.12, 0.2, 1]}
          flags={PREMUL}
        />
      </Rect>
      <Rect x={0} y={0} width={width} height={height} blendMode="hardLight">
        <LinearGradient
          start={linesStart}
          end={linesEnd}
          colors={V_LINES}
          positions={repeatingPositions(V_LINE_STOPS)}
          mode="repeat"
        />
      </Rect>
      <Rect x={0} y={0} width={width} height={height} blendMode="hue">
        <LinearGradient
          start={bandsStart}
          end={bandsEnd}
          colors={after ? V_BANDS_AFTER : V_BANDS}
          positions={repeatingPositions(V_BAND_STOPS)}
          mode="repeat"
        />
      </Rect>
      <Grain width={width} height={height} blendMode="screen" />
    </>
  )
}

/** Wide pastel bands that climb as the card tilts (`.ac-fin-v`). */
const VLayer = ({ width, height, motion, art }: Box & { art: boolean }) => {
  const opacity = useDerivedValue(() => 0.25 + motion.shine.get() * 0.65)
  return (
    <Group
      layer={
        <Paint blendMode="colorDodge" opacity={opacity}>
          <ColorMatrix matrix={V_FILTER} />
        </Paint>
      }
    >
      <VBackgrounds width={width} height={height} motion={motion} after={false} />
      {art && (
        <Group
          layer={
            <Paint blendMode="softLight">
              <ColorMatrix matrix={V_FILTER_AFTER} />
            </Paint>
          }
        >
          <VBackgrounds width={width} height={height} motion={motion} after />
        </Group>
      )}
    </Group>
  )
}

// ---------- By finish ----------

/** The foil of the frame, drawn over its ground and under the image (`.ac-fr-shine`). */
export const FrameShine = ({ finish, ...box }: Box & { finish: CardFinish }) => {
  if (finish === 'reverse' || finish === 'holo-reverse') return <ReverseFrame {...box} />
  if (finish === 'v') return <VLayer {...box} art={false} />
  return <GlitterFrame {...box} />
}

/** The foil of the image, between the backdrop and the person (`.ac-shine-art`). */
export const ArtShine = ({ finish, ...box }: Box & { finish: CardFinish }) => {
  if (finish === 'holo-reverse') return <HoloArt {...box} />
  if (finish === 'cosmos') return <CosmosArt {...box} />
  if (finish === 'v') return <VLayer {...box} art />
  if (finish === 'glitter') return <GlitterArt {...box} />
  return null
}
