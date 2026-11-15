// surface-allow: a collectible card is a drawn object with its own edge, radius and shadow (ADR-0090)
import { Image } from 'expo-image'
import { View } from 'react-native'

import type { EntityCardView } from './cardCatalog'
import { CARD_RATIO } from './cardGeometry'
import { CARD_ICON_HEIGHT, CARD_ICON_WIDTH, CardIcon } from './CardIcon'
import { getCardPalette } from './cardPalettes'

const ANGLES = [-12, 0, 12]

/** The room a fan of cards this wide takes, its outer cards turned out. */
export const getCardFanSize = (cardWidth: number) => ({
  width: Math.round(cardWidth * 2.15),
  height: Math.round(cardWidth * CARD_RATIO * 1.12),
})

/**
 * The last cards collected, fanned out (ADR-0090): the newest in front. Without any, three grey
 * cards stand in their place. The home shows it small, the album large.
 */
export const CardFan = ({ cards, cardWidth }: { cards: EntityCardView[]; cardWidth: number }) => {
  const size = getCardFanSize(cardWidth)
  const cardHeight = Math.round(cardWidth * CARD_RATIO)
  const radius = Math.max(4, Math.round(cardWidth * 0.12))
  const spread = cardWidth / 30
  return (
    <View
      style={{
        width: size.width,
        height: size.height,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {cards.length
        ? [...cards].reverse().map((card, index, list) => {
            const palette = getCardPalette(card.family, card.stages)
            const angle = ANGLES[index + (3 - list.length)] ?? 0
            return (
              <View
                key={card.id}
                style={{
                  position: 'absolute',
                  width: cardWidth,
                  height: cardHeight,
                  borderRadius: radius,
                  borderCurve: 'continuous',
                  overflow: 'hidden',
                  borderWidth: cardWidth > 40 ? 1.5 : 1,
                  borderColor: palette.f2,
                  backgroundColor: palette.artBg,
                  transform: [{ translateX: angle * 1.1 * spread }, { rotate: `${angle}deg` }],
                  boxShadow: '0 1px 4px rgba(0, 0, 0, 0.25)',
                }}
              >
                <Image
                  source={{ uri: card.backdrop ?? card.picture }}
                  style={{ position: 'absolute', inset: 0 }}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
                {!card.scene && (
                  <Image
                    source={{ uri: card.picture }}
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: cardHeight * 0.1,
                      height: cardHeight * 0.72,
                    }}
                    contentFit="cover"
                    contentPosition="top"
                    cachePolicy="memory-disk"
                  />
                )}
              </View>
            )
          })
        : ANGLES.map(angle => (
            <View
              key={angle}
              style={{
                position: 'absolute',
                width: CARD_ICON_WIDTH,
                height: CARD_ICON_HEIGHT,
                transform: [
                  { translateX: angle * spread },
                  { rotate: `${angle}deg` },
                  { scale: cardWidth / 30 },
                ],
              }}
            >
              <CardIcon collected={false} />
            </View>
          ))}
    </View>
  )
}
