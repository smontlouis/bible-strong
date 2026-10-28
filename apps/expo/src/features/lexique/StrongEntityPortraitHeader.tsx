import { Image } from 'expo-image'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, StyleSheet } from 'react-native'

import books from '~assets/bible_versions/books-desc'
import Box, { HStack, TouchableBox, VStack } from '~common/ui/Box'
import Card from '~common/ui/Card'
import { FeatherIcon } from '~common/ui/Icon'
import IconTile from '~common/ui/IconTile'
import Text from '~common/ui/Text'
import { StudySection } from '~common/ui/StudySection'
import type { StrongLexiconEntity } from '~features/resources/strongLexiconAccess'
import { formatStrongDisplayCode } from '~helpers/strongIdentities'
import {
  formatEntityChapterRanges,
  getEntityAvatarRadius,
  getEntityPortraitText,
  getEntitySeriesPlace,
  type EntityPortraitCatalog,
  type EntityPortraitEntry,
} from './entityPortraits'
import { getEntityLabel } from './StrongDetailUI'
import { useEntityPortraitImage } from './useEntityPortraitImage'

const STAGE_TILE_SIZE = 92
const TITLE_FONT = 'Literata Book'

const StageTile = ({
  uniqueName,
  hash,
  label,
  chapters,
  selected,
  onPress,
}: {
  uniqueName: string
  hash: string
  label: string
  chapters: string
  selected: boolean
  onPress: () => void
}) => {
  const image = useEntityPortraitImage(uniqueName, hash, 'w256')
  const radius = getEntityAvatarRadius(STAGE_TILE_SIZE)
  return (
    <TouchableBox
      className="overflow-hidden border-continuous"
      style={{ width: STAGE_TILE_SIZE }}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}, ${chapters}`}
    >
      {/* The ring of the chosen stage surrounds the picture, which keeps its own corners. */}
      <Box
        className={`overflow-hidden border-continuous items-center justify-center ${selected ? 'border-primary' : 'border-transparent'}`}
        style={{
          width: STAGE_TILE_SIZE,
          height: STAGE_TILE_SIZE,
          borderRadius: radius,
          borderWidth: 3,
        }}
      >
        <Box
          className="overflow-hidden border-continuous bg-canvas"
          style={{
            width: STAGE_TILE_SIZE - 10,
            height: STAGE_TILE_SIZE - 10,
            borderRadius: radius - 5,
          }}
        >
          {!!image.uri && (
            <Image
              source={{ uri: image.uri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              cachePolicy="memory-disk"
              recyclingKey={image.uri}
              onError={image.onError}
            />
          )}
        </Box>
      </Box>
      <Text className="text-[12px] font-semibold text-default mt-[7px]" numberOfLines={2}>
        {label}
      </Text>
      <Text className="text-[11px] text-grey mt-[2px]" numberOfLines={2}>
        {chapters}
      </Text>
    </TouchableBox>
  )
}

/**
 * The head of a painted entity's profile: its portrait in a large card with its name and title,
 * its roles and Strong numbers, its series and its stages (ADR-0089). Choosing a stage shows its
 * picture and title in the card.
 */
const StrongEntityPortraitHeader = ({
  entity,
  entry,
  catalog,
  language,
  onOpenStrong,
}: {
  entity: StrongLexiconEntity
  entry: EntityPortraitEntry
  catalog: EntityPortraitCatalog
  language: string
  onOpenStrong: (stepCode: string) => void
}) => {
  const { t } = useTranslation()
  const [stageKey, setStageKey] = useState<string>()
  const stage = entry.stages?.find(item => item.key === stageKey)
  const image = useEntityPortraitImage(entity.uniqueName, stage?.hash ?? entry.hash, 'w768')
  const title = stage?.label ?? entry.title
  const series = getEntitySeriesPlace(catalog, entity.uniqueName)
  const roles = (entry.roles ?? []).flatMap(role =>
    catalog.roles[role] ? [getEntityPortraitText(catalog.roles[role], language)] : []
  )
  const getBookName = (book: number) => {
    const name = books.find(item => item.Numero === book)?.Nom
    return name ? t(name, { lng: language }) : String(book)
  }

  return (
    <VStack className="overflow-hidden border-continuous gap-[14px]">
      <Box className="overflow-hidden border-continuous bg-surface rounded-[24px] p-[10px]">
        <Box
          className="overflow-hidden border-continuous bg-canvas rounded-[16px]"
          style={{ aspectRatio: 1 }}
        >
          {!!image.uri && (
            <Image
              source={{ uri: image.uri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={200}
              recyclingKey={image.uri}
              onError={image.onError}
              accessibilityLabel={entity.name}
            />
          )}
          {!!series && (
            <Box className="overflow-hidden border-continuous absolute top-[10px] right-[10px] rounded-full bg-surface px-[10px] py-[4px]">
              <Text className="text-[12px] font-semibold text-default">
                {series.rank} / {series.total}
              </Text>
            </Box>
          )}
        </Box>
        <VStack className="overflow-hidden border-continuous px-[8px] pt-[14px] pb-[6px] gap-[3px]">
          <Text
            className="text-[12px] font-semibold text-grey"
            style={{ letterSpacing: 1.6, textTransform: 'uppercase' }}
          >
            {getEntityLabel(entity.category, entity.type, t)}
          </Text>
          <Text
            className="text-default"
            style={{ fontFamily: TITLE_FONT, fontSize: 32, lineHeight: 38 }}
          >
            {entity.name}
          </Text>
          {!!title && (
            <Text
              className="text-grey"
              style={{ fontFamily: TITLE_FONT, fontSize: 17, lineHeight: 24 }}
            >
              {getEntityPortraitText(title, language)}
            </Text>
          )}
        </VStack>
      </Box>

      {(roles.length > 0 || entity.strongCodes.length > 0) && (
        <HStack className="overflow-hidden border-continuous gap-[6px] flex-wrap">
          {roles.map(role => (
            <Box
              key={role}
              className="overflow-hidden border-continuous bg-surface rounded-full px-[11px] py-[5px]"
            >
              <Text className="text-[13px] text-default">{role}</Text>
            </Box>
          ))}
          {entity.strongCodes.map(code => (
            <TouchableBox
              key={code}
              className="overflow-hidden border-continuous bg-light-primary rounded-full px-[11px] py-[5px]"
              onPress={() => onOpenStrong(code)}
              activeOpacity={0.7}
              accessibilityRole="link"
              accessibilityLabel={formatStrongDisplayCode(code)}
            >
              <Text className="text-[13px] font-semibold text-link">
                {formatStrongDisplayCode(code)}
              </Text>
            </TouchableBox>
          ))}
        </HStack>
      )}

      {!!series && (
        <Card>
          <HStack className="overflow-hidden border-continuous items-center gap-[12px] px-[14px] py-[12px]">
            <IconTile tint="primary">
              <FeatherIcon name="layers" size={16} color="primary" />
            </IconTile>
            <VStack className="overflow-hidden border-continuous flex-[1]">
              <Text className="text-[15px] font-semibold text-default">
                {getEntityPortraitText(series.title, language)}
              </Text>
              <Text className="text-[13px] text-grey">
                {t('strongDetail.entity.seriesRank', {
                  rank: series.rank,
                  total: series.total,
                  lng: language,
                })}
              </Text>
            </VStack>
          </HStack>
        </Card>
      )}

      {!!entry.stages?.length && (
        <StudySection
          title={
            entry.stagesLabel
              ? getEntityPortraitText(entry.stagesLabel, language)
              : t('strongDetail.entity.lifeStages')
          }
          surface="none"
        >
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <HStack className="overflow-hidden border-continuous gap-[12px]">
              <StageTile
                uniqueName={entity.uniqueName}
                hash={entry.hash}
                label={entry.title ? getEntityPortraitText(entry.title, language) : entity.name}
                chapters={t('strongDetail.entity.elsewhere')}
                selected={!stage}
                onPress={() => setStageKey(undefined)}
              />
              {entry.stages.map(item => (
                <StageTile
                  key={item.key}
                  uniqueName={entity.uniqueName}
                  hash={item.hash}
                  label={getEntityPortraitText(item.label, language)}
                  chapters={formatEntityChapterRanges(item.ranges, getBookName)}
                  selected={item.key === stage?.key}
                  onPress={() => setStageKey(item.key)}
                />
              ))}
            </HStack>
          </ScrollView>
        </StudySection>
      )}
    </VStack>
  )
}

export default StrongEntityPortraitHeader
