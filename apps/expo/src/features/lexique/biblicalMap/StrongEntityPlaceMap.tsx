import { biblicalMapBounds } from '@bible-strong/resource-domain/biblical-map'
import { useTranslation } from 'react-i18next'
import { Linking } from 'react-native'

import { HStack, TouchableBox, VStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import type { StrongLexiconEntity } from '~features/resources/strongLexiconAccess'
import BiblicalMap from './BiblicalMap'
import { useBiblicalPlaces } from './useBiblicalPlaces'

const MAP_HEIGHT = 230

/**
 * Where a place of the Bible lies: a still map around it with its neighbours, which opens the map
 * of every place. A place the publication cannot locate says so.
 */
const StrongEntityPlaceMap = ({
  entity,
  onOpenMap,
}: {
  entity: StrongLexiconEntity
  onOpenMap: (focus: string) => void
}) => {
  const { t } = useTranslation()
  const { places, loading } = useBiblicalPlaces()
  const place = entity.place
  const self = places.find(item => item.uniqueName === entity.uniqueName)
  const region = self ? biblicalMapBounds([self], 170) : undefined

  return (
    <VStack className="overflow-hidden border-continuous gap-[10px]">
      {region ? (
        <TouchableBox
          className="overflow-hidden border-continuous rounded-[16px]"
          onPress={() => onOpenMap(entity.uniqueName)}
          accessibilityRole="button"
          accessibilityLabel={t('strongDetail.entity.mapOpen')}
        >
          <BiblicalMap
            places={places}
            focus={entity.uniqueName}
            region={region}
            style={{ height: MAP_HEIGHT }}
          />
          <HStack
            className="overflow-hidden border-continuous items-center gap-[6px] bg-surface-raised rounded-full px-[12px] py-[7px]"
            style={{ position: 'absolute', right: 10, bottom: 10 }}
          >
            <FeatherIcon name="maximize-2" size={14} color="link" />
            <Text className="text-[13px] font-semibold text-link">
              {t('strongDetail.entity.mapOpen')}
            </Text>
          </HStack>
        </TouchableBox>
      ) : (
        !loading && (
          <Text className="text-grey text-[14px]">{t('strongDetail.entity.locationUnknown')}</Text>
        )
      )}
      {!!place?.area && (
        <Text className="text-grey text-[14px]">
          {t('strongDetail.entity.region', { region: place.area })}
        </Text>
      )}
      {(!!place?.palopenmapsUrl || !!place?.googleMapUrl) && region && (
        <HStack className="overflow-hidden border-continuous gap-[16px] flex-wrap">
          {!!place?.palopenmapsUrl && (
            <TouchableBox onPress={() => Linking.openURL(place.palopenmapsUrl!)}>
              <Text className="text-link font-semibold text-[13px]">
                {t('strongDetail.entity.bibleMap')}
              </Text>
            </TouchableBox>
          )}
          {!!place?.googleMapUrl && (
            <TouchableBox onPress={() => Linking.openURL(place.googleMapUrl!)}>
              <Text className="text-link font-semibold text-[13px]">Google Maps</Text>
            </TouchableBox>
          )}
        </HStack>
      )}
    </VStack>
  )
}

export default StrongEntityPlaceMap
