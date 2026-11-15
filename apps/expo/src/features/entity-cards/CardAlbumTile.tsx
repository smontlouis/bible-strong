// surface-allow: a collectible card is a drawn object with its own edge, radius and shadow (ADR-0090)
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, View } from 'react-native'

import { backgroundImage } from '~common/ui/backgroundImage'
import Text from '~common/ui/Text'
import { useEntityPortraitGround } from '~features/lexique/useEntityPortraitGround'

import type { EntityCardView } from './cardCatalog'
import { CARD_RATIO } from './cardGeometry'
import { CardIcon } from './CardIcon'
import { getCardPalette } from './cardPalettes'

type CardAlbumTileProps = {
  card: EntityCardView
  width: number
  collected: boolean
  /** The book where the character is first met, the hint of a card still to find. */
  meetingBook: string
  /** Opens a collected card large; a card still to find does nothing. */
  onPress: () => void
}

/**
 * A card of the album (ADR-0090), drawn still and small: a collected card shows its painting and
 * its family's edge; a card still to find shows the clay ground, a grey card and where its
 * character is met. Both lead somewhere: the card large, or the character's page.
 */
export const CardAlbumTile = ({
  card,
  width,
  collected,
  meetingBook,
  onPress,
}: CardAlbumTileProps) => {
  const { t } = useTranslation()
  const ground = useEntityPortraitGround()
  const height = Math.round(width * CARD_RATIO)
  const radius = Math.round(width * 0.07)
  const palette = getCardPalette(card.family, card.stages)

  if (!collected) {
    return (
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={t('collection.missing', { book: meetingBook })}
        style={{
          width,
          height,
          borderRadius: radius,
          borderCurve: 'continuous',
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 8,
          gap: 10,
          ...backgroundImage(ground),
        }}
      >
        <CardIcon collected={false} />
        <Text className="text-[11px] text-grey text-center" numberOfLines={2}>
          {meetingBook}
        </Text>
      </View>
    )
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('entityCards.open', { name: card.name })}
      onPress={onPress}
      style={({ pressed }) => ({
        width,
        height,
        borderRadius: radius,
        borderCurve: 'continuous',
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: palette.f2,
        backgroundColor: palette.artBg,
        transform: [{ scale: pressed ? 0.96 : 1 }],
        boxShadow: `0 2px 8px rgba(0, 0, 0, 0.18)`,
      })}
    >
      {card.scene ? (
        <Image
          source={{ uri: card.picture }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition="top"
          cachePolicy="memory-disk"
          recyclingKey={card.picture}
          transition={150}
        />
      ) : (
        <>
          {!!card.backdrop && (
            <Image
              source={{ uri: card.backdrop }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              contentPosition={{ left: '50%', top: '28%' }}
              cachePolicy="memory-disk"
              recyclingKey={card.backdrop}
              transition={150}
            />
          )}
          {/* The person stands lower than the top, as on the card, its head clear of the edge. */}
          <Image
            source={{ uri: card.picture }}
            style={{ position: 'absolute', left: 0, right: 0, top: height * 0.08, height: width }}
            contentFit="cover"
            contentPosition="top"
            cachePolicy="memory-disk"
            recyclingKey={card.picture}
            transition={150}
          />
        </>
      )}
      <LinearGradient
        colors={['rgba(5, 8, 16, 0)', 'rgba(5, 8, 16, 0.55)', 'rgba(5, 8, 16, 0.9)']}
        locations={[0, 0.45, 1]}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: height * 0.42 }}
      />
      <View style={{ position: 'absolute', left: 8, right: 8, bottom: 8, gap: 1 }}>
        <Text
          className="text-[12px] font-bold"
          style={{ color: '#f6efe0', letterSpacing: 0.3 }}
          numberOfLines={1}
        >
          {card.name}
        </Text>
        {!!card.title && (
          <Text
            className="text-[10px]"
            style={{ color: 'rgba(246, 239, 224, 0.78)', fontStyle: 'italic' }}
            numberOfLines={2}
          >
            {card.title}
          </Text>
        )}
      </View>
    </Pressable>
  )
}
