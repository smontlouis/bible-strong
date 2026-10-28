import { pageContentStyle } from '~common/ui/PageContent'
import React from 'react'
import { Linking, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import Empty from '~common/Empty'
import Loading from '~common/Loading'
import Box, { HStack, TouchableBox, VStack, usePageBottomInset } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import type {
  StrongLexiconEntity,
  StrongLexiconEntityRelation,
} from '~features/resources/strongLexiconAccess'
import Card from '~common/ui/Card'
import { StrongEntityRelationList, StrongEntitySummaryCard } from './StrongDetailUI'
import { STUDY_COLUMN_MAX_WIDTH, StudyCardBody, StudySection } from '~common/ui/StudySection'
import { StrongEntityRelationGraph } from './StrongEntityRelationGraph'
import StrongEntityPortraitHeader from './StrongEntityPortraitHeader'
import { useEntityPortraitCatalog } from './entityPortraitManifest'
import { splitStrongEntityRelations } from './strongEntityPresentation'
import type { StrongReadingTypography } from './strongEditorialHtmlStyles'
type Props = {
  language?: 'fr' | 'en'
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
  language,
  entity,
  loading,
  readingTypography,
  onOpenBibleReference,
  onOpenStrong,
  onOpenEntityProfile,
  onOpenEntityRelation,
}: Props) => {
  const { t, i18n } = useTranslation()
  const bottomInset = usePageBottomInset()
  const catalog = useEntityPortraitCatalog()
  if (loading) return <Loading message={t('Chargement...')} />
  if (!entity) {
    return <Empty message={t('strongDetail.entity.unavailable')} />
  }

  const { graph, remaining } = splitStrongEntityRelations(entity)
  const place = entity.place
  // A painted entity opens on its portrait (ADR-0089); the others keep the compact card.
  const portrait = catalog?.entities[entity.uniqueName]

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[
        pageContentStyle,
        {
          maxWidth: STUDY_COLUMN_MAX_WIDTH + 40,
          paddingHorizontal: 20,
          paddingTop: 22,
          paddingBottom: 90 + bottomInset,
        },
      ]}
    >
      {catalog && portrait && (
        <StrongEntityPortraitHeader
          entity={entity}
          entry={portrait}
          catalog={catalog}
          language={language ?? i18n.language}
          onOpenStrong={onOpenStrong}
        />
      )}
      {portrait ? (
        <StudySection title={t('strongDetail.entity.presentation')}>
          <StrongEntitySummaryCard
            entity={entity}
            expanded
            hidesHeader
            readingTypography={readingTypography}
            onOpenBibleReference={onOpenBibleReference}
            onOpenStrong={onOpenStrong}
          />
        </StudySection>
      ) : (
        <Card>
          <StudyCardBody>
            <StrongEntitySummaryCard
              entity={entity}
              expanded
              readingTypography={readingTypography}
              onOpenBibleReference={onOpenBibleReference}
              onOpenStrong={onOpenStrong}
            />
          </StudyCardBody>
        </Card>
      )}

      {ENTITY_LOCATION_VISIBLE && !!place && (
        <StudySection title={t('strongDetail.entity.location')}>
          <VStack className="overflow-hidden border-continuous gap-[8px]">
            <HStack className="overflow-hidden border-continuous items-center gap-[10px]">
              <Box
                className="overflow-hidden border-continuous rounded-full bg-light-primary items-center justify-center"
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
                  <Text className="text-link font-bold text-[13px]">
                    {t('strongDetail.entity.bibleMap')}
                  </Text>
                </TouchableBox>
              )}
              {!!place.googleMapUrl && (
                <TouchableBox
                  className="overflow-hidden border-continuous"
                  onPress={() => Linking.openURL(place.googleMapUrl!)}
                >
                  <Text className="text-link font-bold text-[13px]">Google Maps</Text>
                </TouchableBox>
              )}
            </HStack>
          </VStack>
        </StudySection>
      )}

      {graph.length > 0 && (
        <StudySection title={t('strongDetail.entity.relationships')} surface="none">
          <StrongEntityRelationGraph
            languageOverride={language}
            entity={entity}
            currentProfileEntityKey={entity.uniqueName}
            onOpenProfile={onOpenEntityProfile}
            onOpenEntity={onOpenEntityRelation}
          />
        </StudySection>
      )}

      {remaining.length > 0 && (
        <StudySection
          title={
            graph.length > 0
              ? t('strongDetail.entity.allRelationships')
              : t('strongDetail.entity.relationships')
          }
          surface="none"
        >
          <StrongEntityRelationList relations={remaining} onOpenEntity={onOpenEntityRelation} />
        </StudySection>
      )}
    </ScrollView>
  )
}

export default StrongEntityPage
