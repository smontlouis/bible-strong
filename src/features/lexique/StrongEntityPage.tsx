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
import type { StrongLexiconModuleAvailability } from '~helpers/strongLexiconModules'
import {
  StrongEditorialSection,
  StrongEntityRelationGraph,
  StrongEntityRelationList,
  StrongEntitySummaryCard,
  StrongReferenceCloud,
} from './StrongDetailUI'
import StrongLexiconModuleCard from './StrongLexiconModuleCard'
import { splitStrongEntityRelations } from './strongEntityPresentation'

type Props = {
  entity?: StrongLexiconEntity
  availability: StrongLexiconModuleAvailability
  loading: boolean
  onOpenBibleReference: (osis: string) => void
  onOpenStrong: (stepCode: string) => void
  onOpenEntityRelation: (relation: StrongLexiconEntityRelation) => void
}

const StrongEntityPage = ({
  entity,
  availability,
  loading,
  onOpenBibleReference,
  onOpenStrong,
  onOpenEntityRelation,
}: Props) => {
  const { t } = useTranslation()
  if (loading) return <Loading message={t('Chargement...')} />
  if (!entity) {
    if (availability.status !== 'available') {
      return (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 22, paddingBottom: 90 }}
        >
          <StrongLexiconModuleCard
            moduleId="entities"
            availability={availability}
            title={t('strongLexicon.biblicalEntities')}
            description={t('strongLexicon.biblicalEntitiesDescription')}
          />
        </ScrollView>
      )
    }
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
        onOpenBibleReference={onOpenBibleReference}
        onOpenStrong={onOpenStrong}
      />

      {!!place && (
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
          <StrongEntityRelationGraph entity={entity} onOpenEntity={onOpenEntityRelation} />
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

      {entity.references.length > 0 && (
        <StrongEditorialSection title={t('strongDetail.entity.references')} separated>
          <HStack justifyContent="space-between" alignItems="baseline">
            <Text bold fontSize={18}>
              {t('strongDetail.entity.firstReferences')}
            </Text>
            <Text color="tertiary" fontSize={11}>
              {t('strongDetail.entity.totalReferences', {
                count: entity.references.length + entity.hiddenReferenceCount,
              })}
            </Text>
          </HStack>
          <StrongReferenceCloud
            references={entity.references}
            hiddenCount={entity.hiddenReferenceCount}
            onOpenReference={onOpenBibleReference}
          />
        </StrongEditorialSection>
      )}
    </ScrollView>
  )
}

export default StrongEntityPage
