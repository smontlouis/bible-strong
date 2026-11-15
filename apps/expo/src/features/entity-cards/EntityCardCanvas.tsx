import { BlurMask, Canvas, Group, RoundedRect, rect, rrect } from '@shopify/react-native-skia'
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { EntityPortraitTiltSensor } from '~features/lexique/EntityPortraitParallax'

import type { EntityCardView } from './cardCatalog'
import { CARD_RATIO } from './cardGeometry'
import { useCardMotion } from './cardMotion'
import { getCardPalette } from './cardPalettes'
import { buildBackParagraphs, buildFrontParagraphs } from './cardParagraphs'
import { useCardFonts, useCardPicture } from './cardResources'
import { CardBack, CardFront } from './CardFaces'

/** The room around the card, in shares of its width, for its turn and its glow. */
const ROOM = 0.14

/** The size a card of this width takes on screen, with the room for its turn and its glow. */
export const getEntityCardCanvasSize = (width: number) => {
  const pad = Math.round(ROOM * width)
  return { width: width + 2 * pad, height: Math.round(width * CARD_RATIO) + 2 * pad, pad }
}

type EntityCardCanvasProps = {
  card: EntityCardView
  /** The width of the card itself; the canvas is larger by its room. */
  width: number
  /** Read the phone's tilt; off for a card that only shows. */
  moves?: boolean
  /** The card is drawn whole: its lettering set and its pictures loaded or given up. */
  onReady?: () => void
}

/**
 * A collectible card (ADR-0090) drawn with Skia, as the atlas draws it in CSS: its foil follows
 * the light, its depths move with the turn, a touch turns it over. The finger tilts it; when no
 * finger does, the phone's tilt does.
 */
export const EntityCardCanvas = ({ card, width, moves = true, onReady }: EntityCardCanvasProps) => {
  const height = Math.round(width * CARD_RATIO)
  const canvas = getEntityCardCanvasSize(width)
  const { pad } = canvas
  const palette = getCardPalette(card.family, card.stages)

  const fonts = useCardFonts()
  const backdropPicture = useCardPicture(card.scene ? null : card.backdrop)
  const subjectPicture = useCardPicture(card.picture)
  const backdrop = backdropPicture.image
  const subject = subjectPicture.image

  const front = fonts ? buildFrontParagraphs(card, palette, fonts, width) : null
  const back = fonts ? buildBackParagraphs(card, palette, fonts, width) : null

  const { motion, gravity, touch, flipped } = useCardMotion()

  // The card comes in whole, once its lettering is set and its pictures are there (or given up);
  // each picture still fades in, should it come later.
  const appear = useSharedValue(0)
  const backdropOpacity = useSharedValue(0)
  const subjectOpacity = useSharedValue(0)
  const ready = !!front && backdropPicture.settled && subjectPicture.settled
  useEffect(() => {
    if (!ready) return
    appear.set(withTiming(1, { duration: 250 }))
    onReady?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, appear])
  useEffect(() => {
    if (backdrop) backdropOpacity.set(withTiming(1, { duration: 350 }))
  }, [backdrop, backdropOpacity])
  useEffect(() => {
    if (subject) subjectOpacity.set(withTiming(1, { duration: 350 }))
  }, [subject, subjectOpacity])

  // The card turns inside the canvas, in Skia's own perspective: a native 3D transform cuts it
  // where it crosses the plane of the screen. As the atlas: `rotateY(--rotate-x + --flip)
  // rotateX(--rotate-y)`, the corner under the light coming forward.
  const center = { x: pad + width / 2, y: pad + height / 2 }
  const cardTransform = useDerivedValue(() => [
    { perspective: 900 },
    { rotateY: ((motion.rotateX.get() + motion.flip.get()) * Math.PI) / 180 },
    { rotateX: (motion.rotateY.get() * Math.PI) / 180 },
  ])
  // Only the face turned to the reader is drawn; a group's opacity does not reach its lettering.
  const [facing, setFacing] = useState<'front' | 'back'>('front')
  useAnimatedReaction(
    () => Math.cos(((motion.rotateX.get() + motion.flip.get()) * Math.PI) / 180) >= 0,
    (front, previous) => {
      if (front !== previous) scheduleOnRN(setFacing, front ? 'front' : 'back')
    }
  )

  const toLight = (x: number, y: number) => {
    'worklet'
    return { x: ((x - pad) / width) * 100, y: ((y - pad) / height) * 100 }
  }
  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin(event => {
      touch.set(toLight(event.x, event.y))
    })
    .onUpdate(event => {
      touch.set(toLight(event.x, event.y))
    })
    .onFinalize(() => {
      touch.set(null)
    })
  const tap = Gesture.Tap().onEnd(() => {
    flipped.set(!flipped.get())
  })

  const radius = 0.046 * width
  const face = rrect(rect(0, 0, width, height), radius, 0.033 * height)

  if (!front || !back || !ready)
    return <View style={{ width: canvas.width, height: canvas.height }} />

  return (
    <GestureDetector gesture={Gesture.Simultaneous(pan, tap)}>
      <Animated.View style={{ width: canvas.width, height: canvas.height, opacity: appear }}>
        {moves && <EntityPortraitTiltSensor tilt={gravity} />}
        <Canvas style={{ width: canvas.width, height: canvas.height }}>
          <Group>
            <Group transform={cardTransform} origin={center}>
              <Group transform={[{ translateX: pad }, { translateY: pad }]}>
                {/* The glow of an opened card (`.ac-card.is-active .ac-rotator`). */}
                <RoundedRect
                  x={0}
                  y={15}
                  width={width}
                  height={height - 10}
                  r={radius}
                  color="#000"
                >
                  <BlurMask blur={10} style="normal" />
                </RoundedRect>
                <RoundedRect
                  x={-2}
                  y={-2}
                  width={width + 4}
                  height={height + 4}
                  r={radius + 2}
                  color={palette.glow}
                >
                  <BlurMask blur={7} style="normal" />
                </RoundedRect>
                <RoundedRect
                  x={-1}
                  y={-1}
                  width={width + 2}
                  height={height + 2}
                  r={radius + 1}
                  color={palette.edge}
                >
                  <BlurMask blur={1.5} style="normal" />
                </RoundedRect>

                {facing === 'front' ? (
                  <Group clip={face}>
                    <CardFront
                      card={card}
                      palette={palette}
                      width={width}
                      height={height}
                      motion={motion}
                      paragraphs={front}
                      pictures={{ backdrop, subject, backdropOpacity, subjectOpacity }}
                    />
                  </Group>
                ) : (
                  <Group
                    transform={[{ rotateY: Math.PI }]}
                    origin={{ x: width / 2, y: height / 2 }}
                  >
                    <Group clip={face}>
                      <CardBack
                        card={card}
                        palette={palette}
                        width={width}
                        height={height}
                        motion={motion}
                        paragraphs={back}
                      />
                    </Group>
                  </Group>
                )}
              </Group>
            </Group>
          </Group>
        </Canvas>
      </Animated.View>
    </GestureDetector>
  )
}
