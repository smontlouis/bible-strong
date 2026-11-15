// surface-allow: a collectible card is a drawn object with its own edge, radius and shadow (ADR-0090)
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'
import { useSelector } from 'react-redux'

import { HStack, VStack } from '~common/ui/Box'
import Card from '~common/ui/Card'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { getEntityCardView, type CardLanguage } from '~features/entity-cards/cardCatalog'
import { getCardAlbum, getLatestCollected } from '~features/entity-cards/cardCollection'
import { CARD_ICON_HEIGHT, CARD_ICON_WIDTH, CardIcon } from '~features/entity-cards/CardIcon'
import { getCardPalette } from '~features/entity-cards/cardPalettes'
import { useCardCollectionEnabled } from '~features/entity-cards/useCardCollectionEnabled'
import { useCardCatalog } from '~features/lexique/entityCardManifest'
import { useEntityPortraitCatalog } from '~features/lexique/entityPortraitManifest'
import type { RootState } from '~redux/modules/reducer'

const FAN_WIDTH = 30
const FAN_HEIGHT = 42
const FAN_ANGLES = [-12, 0, 12]

/**
 * The album in « Ma bibliothèque » (ADR-0090): the last cards collected in a small fan, how many
 * the reader holds, and the way into the album.
 */
const HomeCardCollection = () => {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const language: CardLanguage = i18n.language.startsWith('fr') ? 'fr' : 'en'
  const catalog = useCardCatalog()
  const portraits = useEntityPortraitCatalog()
  const collected = useSelector((state: RootState) => state.cards.collected)
  const enabled = useCardCollectionEnabled()
  if (!enabled || !catalog || !portraits) return null

  const album = getCardAlbum(catalog, collected, language)
  const latest = getLatestCollected(catalog, collected, 3).flatMap(card => {
    const view = getEntityCardView(card, catalog, portraits, language, {
      portrait: 'w256',
      backdrop: 'w384',
    })
    return view ? [view] : []
  })

  return (
    <VStack className="px-[20px] mt-[12px]">
      <Card>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t('collection.title')}, ${t('collection.count', {
            count: album.found,
            total: album.total,
          })}`}
          onPress={() => router.push('/cards')}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <HStack className="items-center gap-[14px] px-[16px] py-[14px]">
            <View style={{ width: 64, height: 50, alignItems: 'center', justifyContent: 'center' }}>
              {latest.length
                ? [...latest].reverse().map((card, index, list) => {
                    const palette = getCardPalette(card.family, card.stages)
                    const angle = FAN_ANGLES[index + (3 - list.length)] ?? 0
                    return (
                      <View
                        key={card.id}
                        style={{
                          position: 'absolute',
                          width: FAN_WIDTH,
                          height: FAN_HEIGHT,
                          borderRadius: 4,
                          borderCurve: 'continuous',
                          overflow: 'hidden',
                          borderWidth: 1,
                          borderColor: palette.f2,
                          backgroundColor: palette.artBg,
                          transform: [{ translateX: angle * 1.1 }, { rotate: `${angle}deg` }],
                          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.25)',
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
                            style={{ position: 'absolute', left: 0, right: 0, top: 4, height: 30 }}
                            contentFit="cover"
                            contentPosition="top"
                            cachePolicy="memory-disk"
                          />
                        )}
                      </View>
                    )
                  })
                : FAN_ANGLES.map(angle => (
                    <View
                      key={angle}
                      style={{
                        position: 'absolute',
                        width: CARD_ICON_WIDTH,
                        height: CARD_ICON_HEIGHT,
                        transform: [{ translateX: angle }, { rotate: `${angle}deg` }],
                      }}
                    >
                      <CardIcon collected={false} />
                    </View>
                  ))}
            </View>
            <VStack className="flex-1 min-w-0 gap-[2px]">
              <Text className="text-[16px] font-semibold text-default">
                {t('collection.title')}
              </Text>
              <Text className="text-[13px] text-grey" numberOfLines={2}>
                {album.found > 0
                  ? t('collection.count', { count: album.found, total: album.total })
                  : t('collection.homeEmpty')}
              </Text>
            </VStack>
            <FeatherIcon name="chevron-right" size={18} color="grey" />
          </HStack>
        </Pressable>
      </Card>
    </VStack>
  )
}

export default HomeCardCollection
