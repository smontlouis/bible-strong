import { twMerge } from '~common/ui/classNames'
import { resolveThemeColor, colorWithOpacity } from '~themes/colorValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import PageContent, { PAGE_CONTENT_MAX_WIDTH } from '~common/ui/PageContent'
import React, { useRef, useState } from 'react'
import { ScrollView, type ScrollView as ScrollViewType } from 'react-native'
import { useTranslation } from 'react-i18next'
import Loading from '~common/Loading'
import Box, { HStack, TouchableBox, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import ConcordanceVerse from '~features/bible/ConcordanceVerse'
import ListenToStrong, { hasStrongAudio } from '~features/bible/ListenStrong'
import type { ResolvedPassageMedia } from '~features/bible/passageMedia'
import type {
  StrongLexiconEntry,
  StrongLexiconEntityRelation,
  StrongLexiconMorphology,
} from '~features/resources/strongLexiconAccess'
import type { StrongBibleLemmaStat } from '~helpers/strongBibleSidecar'
import { getStrongReferenceNumber } from '~helpers/strongIdentities'
import type { Verse } from '~common/types'
import {
  StrongEditorialHtml,
  StrongEditorialPreview,
  StrongEditorialSection,
  StrongEyebrow,
  StrongEntityRelationList,
  StrongEntitySummaryCard,
  StrongLexicalRelationCard,
  StrongPreviewLink,
} from './StrongDetailUI'
import { StrongEntityRelationGraph } from './StrongEntityRelationGraph'
import {
  formatStrongContextMorphology,
  getStrongContextVerseText,
} from './strongContextPresentation'
import { splitStrongEntityRelations } from './strongEntityPresentation'
import { splitStrongLexicalRelations } from './strongLexiconRelations'
import { hasHiddenStrongPreviewItems } from './strongDetailPreview'
import { getScaledStrongTextStyle, type StrongReadingTypography } from './strongEditorialHtmlStyles'
import { formatStrongLemmaPartOfSpeech } from './strongLemmaPartOfSpeech'
import { isStrongOriginalUnnamed } from './strongOriginalPresentation'
import StrongPassageMediaSection from './StrongPassageMediaSection'
type Anchor = 'context' | 'definition' | 'media' | 'entity' | 'related' | 'concordance'

type Props = {
  entry: StrongLexiconEntry
  passageMedia: ResolvedPassageMedia[]
  contextVerse?: Verse
  contextReference?: string
  contextVersion?: string
  clickedWord?: string
  contextMorphologies?: StrongLexiconMorphology[]
  concordanceCount: number
  concordanceTotalCount: number
  concordanceVersion: string
  concordanceVerses: Verse[]
  concordanceLoading: boolean
  lemmaStats: StrongBibleLemmaStat[]
  selectedLemmaId?: number
  readingTypography: StrongReadingTypography
  onSelectLemma: (lemmaId?: number) => void
  onOpenPage: (page: 'entity' | 'dictionary' | 'related' | 'concordance') => void
  onOpenStrong: (stepCode: string) => void
  onOpenBibleReference: (osis: string) => void
  onOpenConcordanceVerse: (verse: Verse) => void
  onOpenEntityProfile: (entityKey: string) => void
  onOpenEntityRelation: (relation: StrongLexiconEntityRelation) => void
}

const HighlightedVerse = ({
  text,
  word,
  untranslatedOffset,
  readingTypography,
}: {
  text: string
  word?: string
  untranslatedOffset?: number
  readingTypography: StrongReadingTypography
}) => {
  if (untranslatedOffset != null)
    return (
      <Text style={getScaledStrongTextStyle(20, 30, readingTypography)}>
        {text.slice(0, untranslatedOffset)}
        <Text
          className="text-primary font-bold"
          style={getScaledStrongTextStyle(26, 30, readingTypography)}
        >
          {' ●'}
        </Text>
        {text.slice(untranslatedOffset)}
      </Text>
    )
  if (!word) return <Text style={getScaledStrongTextStyle(18, 28, readingTypography)}>{text}</Text>
  const index = text.toLocaleLowerCase().indexOf(word.toLocaleLowerCase())
  if (index < 0)
    return <Text style={getScaledStrongTextStyle(18, 28, readingTypography)}>{text}</Text>

  return (
    <Text style={getScaledStrongTextStyle(20, 30, readingTypography)}>
      {text.slice(0, index)}
      <Text
        className="bg-light-primary text-primary font-bold rounded-[5px] px-[3px]"
        style={getScaledStrongTextStyle(20, 30, readingTypography)}
      >
        {text.slice(index, index + word.length)}
      </Text>
      {text.slice(index + word.length)}
    </Text>
  )
}

const JumpNavigationContent = ({
  anchors,
  onPress,
}: {
  anchors: { id: Anchor; label: string; visible: boolean }[]
  onPress: (anchor: Anchor) => void
}) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={{ paddingHorizontal: 14, gap: 7 }}
  >
    {anchors
      .filter(anchor => anchor.visible)
      .map(anchor => (
        <TouchableBox
          className="overflow-hidden border-continuous"
          key={anchor.id}
          onPress={() => onPress(anchor.id)}
          activeOpacity={0.7}
        >
          <Box className="overflow-hidden border-continuous bg-light-grey rounded-[16px] px-[10px] py-[7px]">
            <Text className="text-[12px] font-bold">{anchor.label}</Text>
          </Box>
        </TouchableBox>
      ))}
  </ScrollView>
)

const StrongDetailMainPage = ({
  entry,
  passageMedia,
  contextVerse,
  contextReference,
  contextVersion,
  clickedWord,
  contextMorphologies = [],
  concordanceCount,
  concordanceTotalCount,
  concordanceVersion,
  concordanceVerses,
  concordanceLoading,
  lemmaStats,
  selectedLemmaId,
  readingTypography,
  onSelectLemma,
  onOpenPage,
  onOpenStrong,
  onOpenBibleReference,
  onOpenConcordanceVerse,
  onOpenEntityProfile,
  onOpenEntityRelation,
}: Props) => {
  const stylingTheme = useStylingTheme()

  const { t, i18n } = useTranslation()
  const scrollRef = useRef<ScrollViewType>(null)
  const [anchorOffsets, setAnchorOffsets] = useState<Partial<Record<Anchor, number>>>({})
  const [dictionaryPreview, setDictionaryPreview] = useState<{
    resourceId: number
    overflows: boolean
  }>()
  const setAnchor = (anchor: Anchor, y: number) => {
    setAnchorOffsets(current => (current[anchor] === y ? current : { ...current, [anchor]: y }))
  }
  const scrollToAnchor = (anchor: Anchor) => {
    const y = anchorOffsets[anchor]
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 54), animated: true })
  }
  const entityRelations = entry.entity ? splitStrongEntityRelations(entry.entity) : undefined
  const entityLabel =
    entry.entity?.category === 'person'
      ? t('strongDetail.jump.person')
      : entry.entity?.category === 'place'
        ? t('strongDetail.entity.place')
        : entry.entity?.category === 'group'
          ? t('strongDetail.entity.group')
          : t('strongDetail.jump.entity')
  const contextText = contextVerse ? getStrongContextVerseText(contextVerse) : undefined
  const untranslatedContextOffset = contextVerse?.StrongSpans?.find(
    span =>
      span.length === 0 &&
      span.identities.some(
        identity =>
          getStrongReferenceNumber(identity.code) === getStrongReferenceNumber(entry.baseCode)
      )
  )?.startOffset
  const dictionaryResource = entry.resources[0]
  const lexicalRelations = splitStrongLexicalRelations(entry.relations)
  const displayedRelationCount = Math.min(lexicalRelations.relatedWords.length, 4)
  const displayedConcordanceCount = Math.min(concordanceVerses.length, 3)
  const isOriginalUnnamed = isStrongOriginalUnnamed(entry.original)
  const originalLabel = isOriginalUnnamed ? t('strongDetail.unnamedPerson') : entry.original

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1 }}
      stickyHeaderIndices={[1]}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 0, paddingBottom: 90 }}
    >
      <VStack
        className="border-continuous overflow-hidden mx-[-20px] px-[20px] pt-[28px] pb-[24px] gap-[11px] border-b-[1px] border-border"
        style={{
          backgroundColor: colorWithOpacity(resolveThemeColor(stylingTheme, 'primary'), 0.1),
        }}
      >
        <PageContent className="gap-[11px]" style={{ maxWidth: PAGE_CONTENT_MAX_WIDTH - 40 }}>
          <Text className="text-primary font-bold text-[12px] uppercase">{entry.stepCode}</Text>
          <HStack className="overflow-hidden border-continuous items-end gap-[16px]">
            <VStack className="overflow-hidden border-continuous flex-[1] gap-[5px]">
              <Text
                accessibilityLanguage={entry.language === 'hebrew' ? 'he-IL' : 'el-GR'}
                style={[
                  { fontWeight: '400' },
                  getScaledStrongTextStyle(
                    isOriginalUnnamed ? 32 : 40,
                    isOriginalUnnamed ? 38 : 45,
                    readingTypography
                  ),
                ]}
              >
                {originalLabel}
              </Text>
              <Text className="font-medium text-[25px]">{entry.gloss}</Text>
              {!isOriginalUnnamed && (entry.transliteration || entry.pronunciation) && (
                <Text className="text-tertiary text-[14px]">
                  {[entry.transliteration, entry.pronunciation].filter(Boolean).join(' · ')}
                </Text>
              )}
            </VStack>
            {!isOriginalUnnamed &&
              hasStrongAudio(entry.language === 'hebrew' ? 'hebreu' : 'grec', entry.baseCode) && (
                <Box
                  className="overflow-hidden border-continuous rounded-[24px] items-center justify-center"
                  style={{
                    backgroundColor: colorWithOpacity(
                      resolveThemeColor(stylingTheme, 'primary'),
                      0.1
                    ),
                    width: 48,
                    height: 48,
                  }}
                >
                  <ListenToStrong
                    type={entry.language === 'hebrew' ? 'hebreu' : 'grec'}
                    code={entry.baseCode}
                  />
                </Box>
              )}
          </HStack>
        </PageContent>
      </VStack>

      <Box className="border-continuous overflow-hidden mx-[-20px] py-[10px] bg-reverse border-b-[1px] border-border z-[10]">
        <PageContent>
          <JumpNavigationContent
            anchors={[
              {
                id: 'context',
                label: t('strongDetail.jump.context'),
                visible: Boolean(contextVerse),
              },
              { id: 'definition', label: t('strongDetail.jump.definition'), visible: true },
              {
                id: 'media',
                label: t('strongDetail.jump.media'),
                visible: passageMedia.length > 0,
              },
              { id: 'entity', label: entityLabel, visible: Boolean(entry.entity) },
              {
                id: 'related',
                label: t('strongDetail.jump.related'),
                visible: lexicalRelations.relatedWords.length > 0,
              },
              {
                id: 'concordance',
                label: t('Concordance'),
                visible: concordanceCount > 0,
              },
            ]}
            onPress={scrollToAnchor}
          />
        </PageContent>
      </Box>

      {!!contextVerse && (
        <StrongEditorialSection
          title={t('strongDetail.context.title')}
          onLayout={event => setAnchor('context', event.nativeEvent.layout.y)}
        >
          <VStack className="overflow-hidden border-continuous border-l-[3px] pl-[17px] py-[5px] gap-[10px]">
            <HighlightedVerse
              text={contextText ?? ''}
              word={clickedWord || entry.gloss}
              untranslatedOffset={untranslatedContextOffset}
              readingTypography={readingTypography}
            />
            <VStack className="overflow-hidden border-continuous gap-[4px]">
              <Text className="text-tertiary text-[12px]">
                {[contextReference, contextVersion].filter(Boolean).join(' · ')}
              </Text>
              {contextMorphologies.map(morphology => (
                <Text className="text-tertiary text-[12px]" key={morphology.code}>
                  {formatStrongContextMorphology(morphology)}
                </Text>
              ))}
              {!contextMorphologies.length && entry.morphology && (
                <Text className="text-tertiary text-[12px]">
                  {formatStrongContextMorphology(entry.morphology)}
                </Text>
              )}
            </VStack>
          </VStack>
        </StrongEditorialSection>
      )}

      {!!contextVerse && (
        <PageContent style={{ maxWidth: PAGE_CONTENT_MAX_WIDTH - 40 }}>
          <Box className="overflow-hidden border-continuous w-[42px] h-[3px] bg-default mt-[34px] mb-[2px]" />
        </PageContent>
      )}

      <StrongEditorialSection
        title={t('strongDetail.definition.title')}
        onLayout={event => setAnchor('definition', event.nativeEvent.layout.y)}
      >
        {entry.nameMeaningHtml && (
          <VStack
            className="overflow-hidden border-continuous gap-[8px]"
            style={{ marginBottom: entry.definitionHtml ? 18 : 0 }}
          >
            <StrongEditorialHtml
              value={entry.nameMeaningHtml}
              readingTypography={readingTypography}
              onOpenBibleReference={onOpenBibleReference}
              onOpenStrong={onOpenStrong}
            />
          </VStack>
        )}
        {entry.definitionHtml ? (
          <StrongEditorialHtml
            value={entry.definitionHtml}
            readingTypography={readingTypography}
            onOpenBibleReference={onOpenBibleReference}
            onOpenStrong={onOpenStrong}
          />
        ) : !entry.nameMeaningHtml ? (
          <Text className="text-tertiary">
            {t('strongLexicon.definitionUnavailable', {
              language: entry.language,
            })}
          </Text>
        ) : null}
        {lexicalRelations.alternateSenses.length > 0 && (
          <VStack className="border-continuous overflow-hidden mt-[10px] pt-[18px] border-t-[1px] border-border gap-[9px]">
            <StrongEyebrow>{t('strongLexicon.otherMeanings')}</StrongEyebrow>
            {lexicalRelations.alternateSenses.map(relation => (
              <StrongLexicalRelationCard
                key={relation.stepCode}
                relation={relation}
                readingTypography={readingTypography}
                onPress={() => onOpenStrong(relation.stepCode)}
              />
            ))}
          </VStack>
        )}
      </StrongEditorialSection>

      {!isOriginalUnnamed &&
        (dictionaryResource ? (
          <StrongEditorialSection title={t('strongDetail.dictionary.light')}>
            <Text className="text-tertiary text-[12px]">
              {dictionaryResource.source} · {dictionaryResource.title}
            </Text>
            <StrongEditorialPreview
              value={dictionaryResource.contentHtml}
              readingTypography={readingTypography}
              numberOfLines={5}
              onOpenBibleReference={onOpenBibleReference}
              onOpenStrong={onOpenStrong}
              onOverflowChange={overflows =>
                setDictionaryPreview(current =>
                  current?.resourceId === dictionaryResource.id && current.overflows === overflows
                    ? current
                    : { resourceId: dictionaryResource.id, overflows }
                )
              }
            />
            {dictionaryPreview?.resourceId === dictionaryResource.id &&
              dictionaryPreview.overflows && (
                <StrongPreviewLink
                  label={t('strongDetail.dictionary.open')}
                  onPress={() => onOpenPage('dictionary')}
                />
              )}
          </StrongEditorialSection>
        ) : null)}

      {passageMedia.length > 0 && (
        <StrongPassageMediaSection
          media={passageMedia}
          title={t('strongDetail.media.title')}
          onLayout={event => setAnchor('media', event.nativeEvent.layout.y)}
        />
      )}

      {!!entry.entity ? (
        <VStack
          className="border-continuous overflow-hidden mx-[-20px] mt-[30px] px-[20px] pt-[22px] pb-[26px] bg-light-grey border-t-[1px] border-b-[1px] border-border gap-[14px]"
          onLayout={event => setAnchor('entity', event.nativeEvent.layout.y)}
        >
          <PageContent className="gap-[14px]" style={{ maxWidth: PAGE_CONTENT_MAX_WIDTH - 40 }}>
            <StrongEntitySummaryCard
              entity={entry.entity}
              plain
              readingTypography={readingTypography}
              onOpenBibleReference={onOpenBibleReference}
              onOpenStrong={onOpenStrong}
            />
            <StrongPreviewLink
              label={t('strongDetail.entity.open', { name: entry.entity.name })}
              onPress={() => onOpenPage('entity')}
            />
            {!!entityRelations?.graph.length && (
              <VStack className="overflow-hidden border-continuous mt-[7px] gap-[10px]">
                <Text className="font-bold text-[17px]">
                  {t(
                    entry.entity.category === 'person'
                      ? 'strongDetail.entity.personalRelationships'
                      : 'strongDetail.entity.relationships'
                  )}
                </Text>
                <StrongEntityRelationGraph
                  entity={entry.entity}
                  onOpenProfile={onOpenEntityProfile}
                  onOpenEntity={onOpenEntityRelation}
                />
              </VStack>
            )}
            {!!entityRelations?.remaining.length && (
              <StrongEntityRelationList
                relations={entityRelations.remaining}
                onOpenEntity={onOpenEntityRelation}
              />
            )}
          </PageContent>
        </VStack>
      ) : null}

      {lexicalRelations.relatedWords.length > 0 && (
        <StrongEditorialSection
          title={t('strongDetail.related.title')}
          onLayout={event => setAnchor('related', event.nativeEvent.layout.y)}
        >
          <VStack className="overflow-hidden border-continuous gap-[9px]">
            {lexicalRelations.relatedWords.slice(0, displayedRelationCount).map(relation => (
              <StrongLexicalRelationCard
                key={relation.stepCode}
                relation={relation}
                readingTypography={readingTypography}
                onPress={() => onOpenStrong(relation.stepCode)}
              />
            ))}
          </VStack>
          {hasHiddenStrongPreviewItems(
            lexicalRelations.relatedWords.length,
            displayedRelationCount
          ) && (
            <StrongPreviewLink
              label={t('strongDetail.related.open')}
              onPress={() => onOpenPage('related')}
            />
          )}
        </StrongEditorialSection>
      )}

      {concordanceCount > 0 && (
        <StrongEditorialSection
          title={t('Concordance')}
          onLayout={event => setAnchor('concordance', event.nativeEvent.layout.y)}
        >
          <HStack className="overflow-hidden border-continuous items-baseline gap-[8px]">
            <Text className="font-bold text-[26px]">{concordanceCount}</Text>
            <Text className="text-tertiary text-[14px]">
              {t('strongDetail.concordance.usesIn', { version: concordanceVersion })}
            </Text>
          </HStack>
          {lemmaStats.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginHorizontal: -20 }}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 7 }}
            >
              <TouchableBox
                className="overflow-hidden border-continuous"
                onPress={() => onSelectLemma(undefined)}
              >
                <Box
                  className={twMerge(
                    'overflow-hidden border-continuous',
                    twMerge(
                      selectedLemmaId == null ? 'bg-primary' : 'bg-light-grey',
                      'overflow-hidden border-continuous rounded-[16px] px-[10px] py-[7px]'
                    )
                  )}
                >
                  <Text
                    className={twMerge(
                      selectedLemmaId == null ? 'text-reverse' : 'text-default',
                      'text-[12px]'
                    )}
                  >
                    {t('Tous')} · {concordanceTotalCount}
                  </Text>
                </Box>
              </TouchableBox>
              {lemmaStats.map(lemma => (
                <TouchableBox
                  className="overflow-hidden border-continuous"
                  key={lemma.id}
                  onPress={() => onSelectLemma(lemma.id)}
                >
                  <Box
                    className={twMerge(
                      'overflow-hidden border-continuous',
                      twMerge(
                        selectedLemmaId === lemma.id ? 'bg-primary' : 'bg-light-grey',
                        'overflow-hidden border-continuous rounded-[16px] px-[10px] py-[7px]'
                      )
                    )}
                  >
                    <Text
                      className={twMerge(
                        selectedLemmaId === lemma.id ? 'text-reverse' : 'text-default',
                        'text-[12px]'
                      )}
                    >
                      {lemma.lemma}{' '}
                      {formatStrongLemmaPartOfSpeech(lemma.partOfSpeech, i18n.language)} ·{' '}
                      {lemma.occurrenceCount}
                    </Text>
                  </Box>
                </TouchableBox>
              ))}
            </ScrollView>
          )}
          {concordanceLoading ? (
            <Loading />
          ) : (
            <VStack className="overflow-hidden border-continuous">
              {concordanceVerses.slice(0, displayedConcordanceCount).map(verse => (
                <ConcordanceVerse
                  key={`${verse.Livre}-${verse.Chapitre}-${verse.Verset}`}
                  onOpenVerse={onOpenConcordanceVerse}
                  t={t}
                  concordanceFor={String(entry.baseCode)}
                  verse={verse}
                />
              ))}
            </VStack>
          )}
          {hasHiddenStrongPreviewItems(concordanceTotalCount, displayedConcordanceCount) && (
            <StrongPreviewLink
              label={t('strongDetail.concordance.open')}
              onPress={() => onOpenPage('concordance')}
            />
          )}
        </StrongEditorialSection>
      )}
    </ScrollView>
  )
}

export default StrongDetailMainPage
