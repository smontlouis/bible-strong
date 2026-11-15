import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Pressable } from 'react-native'
import { useSelector } from 'react-redux'

import { HStack, VStack } from '~common/ui/Box'
import Card from '~common/ui/Card'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { getEntityCardView, type CardLanguage } from '~features/entity-cards/cardCatalog'
import { getCardAlbum, getFanCards } from '~features/entity-cards/cardCollection'
import { CardFan } from '~features/entity-cards/CardFan'
import { useCardCollectionEnabled } from '~features/entity-cards/useCardCollectionEnabled'
import { useCardCatalog } from '~features/lexique/entityCardManifest'
import { useEntityPortraitCatalog } from '~features/lexique/entityPortraitManifest'
import type { RootState } from '~redux/modules/reducer'

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
  const latest = getFanCards(catalog, collected).flatMap(card => {
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
            <CardFan cards={latest} cardWidth={30} />
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
