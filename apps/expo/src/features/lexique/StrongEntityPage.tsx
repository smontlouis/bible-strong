import React from 'react'
import { Linking, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'

import Empty from '~common/Empty'
import Loading from '~common/Loading'
import Box, { HStack, TouchableBox, VStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import type {
  StrongLexiconEntity,
  StrongLexiconEntityRelation,
} from '~features/resources/strongLexiconAccess'
import {
  StrongEditorialSection,
  StrongEntityRelationList,
  StrongEntitySummaryCard,
} from './StrongDetailUI'
import { StrongEntityRelationGraph } from './StrongEntityRelationGraph'
import { splitStrongEntityRelations } from './strongEntityPresentation'
import type { StrongReadingTypography } from './strongEditorialHtmlStyles'

type Props = {
  entity?: StrongLexiconEntity
  loading: boolean
  readingTypography: StrongReadingTypography
  onOpenBibleReference: (osis: string) => void
  onOpenStrong: (stepCode: string) => void
  onOpenEntityProfile: (entityKey: string) => void
  onOpenEntityRelation: (relation: StrongLexiconEntityRelation) => void
}

const ENTITY_LOCATION_VISIBLE = false

const StrongEntityPage = ({
  entity,
  loading,
  readingTypography,
  onOpenBibleReference,
  onOpenStrong,
  onOpenEntityProfile,
  onOpenEntityRelation,
}: Props) => {
  const { t } = useTranslation()
  if (loading) return <Loading message={t('Chargement...')} />
  if (!entity) {
    return (
      <Empty
        source={require('~assets/images/empty.json')}
        message={t('strongDetail.entity.unavailable')}
      />
    )
  }

  const { graph, remaining } = splitStrongEntityRelations(entity)
  const place = entity.place

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 22, paddingBottom: 90 }}
    >
      <StrongEntitySummaryCard
        entity={entity}
        expanded
        readingTypography={readingTypography}
        onOpenBibleReference={onOpenBibleReference}
        onOpenStrong={onOpenStrong}
      />

      {ENTITY_LOCATION_VISIBLE && !!place && (
        <StrongEditorialSection title={t('strongDetail.entity.location')} separated>
          <VStack bg="lightGrey" borderRadius={18} p={16} gap={8}>
            <HStack alignItems="center" gap={10}>
              <Box size={42} borderRadius={21} bg="lightPrimary" center>
                <FeatherIcon name="map-pin" color="primary" size={20} />
              </Box>
              <VStack flex gap={2}>
                <Text bold fontSize={17}>
                  {place.name || entity.name}
                </Text>
                {!!place.area && <Text color="tertiary">{place.area}</Text>}
              </VStack>
            </HStack>
            {place.latitude != null && place.longitude != null && (
              <Text color="tertiary" fontSize={12}>
                {place.latitude}, {place.longitude}
              </Text>
            )}
            <HStack gap={10} wrap>
              {!!place.palopenmapsUrl && (
                <TouchableBox onPress={() => Linking.openURL(place.palopenmapsUrl!)}>
                  <Text color="primary" bold fontSize={13}>
                    {t('strongDetail.entity.bibleMap')}
                  </Text>
                </TouchableBox>
              )}
              {!!place.googleMapUrl && (
                <TouchableBox onPress={() => Linking.openURL(place.googleMapUrl!)}>
                  <Text color="primary" bold fontSize={13}>
                    Google Maps
                  </Text>
                </TouchableBox>
              )}
            </HStack>
          </VStack>
        </StrongEditorialSection>
      )}

      {graph.length > 0 && (
        <StrongEditorialSection title={t('strongDetail.entity.relationships')} separated>
          <StrongEntityRelationGraph
            entity={entity}
            currentProfileEntityKey={entity.uniqueName}
            onOpenProfile={onOpenEntityProfile}
            onOpenEntity={onOpenEntityRelation}
          />
        </StrongEditorialSection>
      )}

      {remaining.length > 0 && (
        <StrongEditorialSection
          title={
            graph.length > 0
              ? t('strongDetail.entity.allRelationships')
              : t('strongDetail.entity.relationships')
          }
          separated
        >
          <StrongEntityRelationList relations={remaining} onOpenEntity={onOpenEntityRelation} />
        </StrongEditorialSection>
      )}
    </ScrollView>
  )
}

export default StrongEntityPage
