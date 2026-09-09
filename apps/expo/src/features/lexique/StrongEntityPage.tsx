import { pageContentStyle } from '~common/ui/PageContent'
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
      contentContainerStyle={[
        pageContentStyle,
        { maxWidth: 600, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 90 },
      ]}
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
          <VStack className="overflow-hidden border-continuous bg-light-grey rounded-[18px] p-[16px] gap-[8px]">
            <HStack className="overflow-hidden border-continuous items-center gap-[10px]">
              <Box
                className="overflow-hidden border-continuous rounded-[21px] bg-light-primary items-center justify-center"
                style={{ width: 42, height: 42 }}
              >
                <FeatherIcon name="map-pin" color="primary" size={20} />
              </Box>
              <VStack className="overflow-hidden border-continuous flex-[1] gap-[2px]">
                <Text className="font-bold text-[17px]">{place.name || entity.name}</Text>
                {!!place.area && <Text className="text-tertiary">{place.area}</Text>}
              </VStack>
            </HStack>
            {place.latitude != null && place.longitude != null && (
              <Text className="text-tertiary text-[12px]">
                {place.latitude}, {place.longitude}
              </Text>
            )}
            <HStack className="overflow-hidden border-continuous gap-[10px] flex-wrap">
              {!!place.palopenmapsUrl && (
                <TouchableBox
                  className="overflow-hidden border-continuous"
                  onPress={() => Linking.openURL(place.palopenmapsUrl!)}
                >
                  <Text className="text-primary font-bold text-[13px]">
                    {t('strongDetail.entity.bibleMap')}
                  </Text>
                </TouchableBox>
              )}
              {!!place.googleMapUrl && (
                <TouchableBox
                  className="overflow-hidden border-continuous"
                  onPress={() => Linking.openURL(place.googleMapUrl!)}
                >
                  <Text className="text-primary font-bold text-[13px]">Google Maps</Text>
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
