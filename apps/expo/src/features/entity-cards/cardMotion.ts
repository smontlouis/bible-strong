import {
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated'

import { useEntityPortraitTilt } from '~features/lexique/EntityPortraitParallax'

import { REST, adjust, clamp, type Point } from './cardGeometry'

/** The share of a full tilt that turns the card, in degrees. */
export const MAX_ROTATION = 14

const SPRING = { damping: 18, stiffness: 110, mass: 0.7 }
const FLIP_SPRING = { damping: 16, stiffness: 90, mass: 0.9 }

/**
 * What every layer of a card reads, as the CSS variables of the atlas: the light (`--pointer-*`,
 * 0 to 100), the turn (`--rotate-*`, degrees), the depth (`--tx`, `--ty`, -1 to 1), the plates of
 * the foils (`--background-*`) and how lit the foil is (`--card-opacity`, `--glare-opacity`).
 */
export type CardMotion = {
  pointerX: SharedValue<number>
  pointerY: SharedValue<number>
  rotateX: SharedValue<number>
  rotateY: SharedValue<number>
  shine: SharedValue<number>
  glare: SharedValue<number>
  flip: SharedValue<number>
  tx: SharedValue<number>
  ty: SharedValue<number>
  backgroundX: SharedValue<number>
  backgroundY: SharedValue<number>
  fromCenter: SharedValue<number>
}

/**
 * The motion of a card: the finger when it touches the card, otherwise the phone's tilt from where
 * it was held. Everything springs toward it on the UI thread.
 */
export const useCardMotion = () => {
  const gravity = useEntityPortraitTilt()
  const touch = useSharedValue<Point | null>(null)

  const rotateX = useSharedValue(0)
  const rotateY = useSharedValue(0)
  const pointerX = useSharedValue(REST.x)
  const pointerY = useSharedValue(REST.y)
  const shine = useSharedValue(REST.shine)
  const glare = useSharedValue(0)
  const flip = useSharedValue(0)
  const flipped = useSharedValue(false)

  useAnimatedReaction(
    () => ({ finger: touch.get(), tilt: gravity.get() }),
    ({ finger, tilt }) => {
      let px: number
      let py: number
      let rx: number
      let ry: number
      let strength: number
      if (finger) {
        px = clamp(finger.x)
        py = clamp(finger.y)
        rx = -((px - 50) / 3.5)
        ry = (py - 50) / 3.5
        strength = 1
      } else {
        px = clamp(50 + tilt.x * 50)
        py = clamp(REST.y + tilt.y * 50)
        rx = -tilt.x * MAX_ROTATION
        ry = tilt.y * MAX_ROTATION
        strength = Math.min(1, Math.sqrt(tilt.x * tilt.x + tilt.y * tilt.y) * 1.6)
      }
      rotateX.set(withSpring(rx, SPRING))
      rotateY.set(withSpring(ry, SPRING))
      pointerX.set(withSpring(px, SPRING))
      pointerY.set(withSpring(py, SPRING))
      shine.set(withSpring(REST.shine + (1 - REST.shine) * strength, SPRING))
      glare.set(withSpring(strength, SPRING))
    }
  )

  useAnimatedReaction(
    () => flipped.get(),
    value => {
      flip.set(withSpring(value ? 180 : 0, FLIP_SPRING))
    }
  )

  const tx = useDerivedValue(() => -rotateX.get() / MAX_ROTATION)
  const ty = useDerivedValue(() => rotateY.get() / MAX_ROTATION)
  const backgroundX = useDerivedValue(() => adjust(pointerX.get(), 0, 100, 37, 63))
  const backgroundY = useDerivedValue(() => adjust(pointerY.get(), 0, 100, 33, 67))
  const fromCenter = useDerivedValue(() => {
    const dx = pointerX.get() - 50
    const dy = pointerY.get() - 50
    return clamp(Math.sqrt(dx * dx + dy * dy) / 50, 0, 1)
  })

  const motion: CardMotion = {
    pointerX,
    pointerY,
    rotateX,
    rotateY,
    shine,
    glare,
    flip,
    tx,
    ty,
    backgroundX,
    backgroundY,
    fromCenter,
  }
  return { motion, gravity, touch, flipped }
}
