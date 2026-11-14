import { Canvas, Group, rect, rrect, useFonts, useImage } from '@shopify/react-native-skia'
import { useEffect } from 'react'
import { View } from 'react-native'
import { useSharedValue, withTiming } from 'react-native-reanimated'

import type { EntityCardView } from './cardCatalog'
import { CARD_RATIO } from './cardGeometry'
import { useCardMotion } from './cardMotion'
import { getCardPalette } from './cardPalettes'
import { LITERATA, buildFrontParagraphs } from './cardParagraphs'
import { CardFront } from './CardFaces'

/**
 * A card drawn small and still, its foil at rest: the copy a collected card leaves in its
 * character's header (ADR-0090). It neither turns nor reads the phone's tilt.
 */
export const EntityCardThumbnail = ({ card, width }: { card: EntityCardView; width: number }) => {
  const height = Math.round(width * CARD_RATIO)
  const palette = getCardPalette(card.family, card.stages)
  const fonts = useFonts({ [LITERATA]: [require('~assets/fonts/LiterataBook-Regular.otf')] })
  const backdrop = useImage(card.scene ? null : (card.backdrop ?? null))
  const subject = useImage(card.picture)
  const front = fonts ? buildFrontParagraphs(card, palette, fonts, width) : null
  const { motion } = useCardMotion()

  // The pictures are those of the large card, already in memory when the card has just landed.
  const backdropOpacity = useSharedValue(backdrop ? 1 : 0)
  const subjectOpacity = useSharedValue(subject ? 1 : 0)
  useEffect(() => {
    if (backdrop) backdropOpacity.set(withTiming(1, { duration: 200 }))
  }, [backdrop, backdropOpacity])
  useEffect(() => {
    if (subject) subjectOpacity.set(withTiming(1, { duration: 200 }))
  }, [subject, subjectOpacity])

  const face = rrect(rect(0, 0, width, height), 0.046 * width, 0.033 * height)

  return (
    <View
      style={{
        width,
        height,
        borderRadius: 0.046 * width,
        boxShadow: `0 2px 6px rgba(0, 0, 0, 0.28), 0 0 0 1px ${palette.edge}`,
      }}
    >
      {front && (
        <Canvas style={{ width, height }}>
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
        </Canvas>
      )}
    </View>
  )
}
