import HorizontalControlScrollView from '~common/HorizontalControlScrollView'
import StrongEntryMetadata from './StrongEntryMetadata'
import { twMerge } from '~common/ui/classNames'
import { resolveThemeColor, colorWithOpacity } from '~themes/colorValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import PageContent from '~common/ui/PageContent'
import { useAtom } from 'jotai/react'
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
  StrongEntityRelationList,
  StrongEntitySummaryCard,
  StrongLevelSwitch,
  StrongLexicalRelationCard,
  StrongPreviewLink,
} from './StrongDetailUI'
import { strongDefinitionLevelAtom } from './atoms'
import { StrongEntityRelationGraph } from './StrongEntityRelationGraph'
import {
  formatStrongContextMorphology,
  getStrongContextHighlight,
  getStrongContextVerseText,
  type StrongContextHighlight,
} from './strongContextPresentation'
import { splitStrongEntityRelations } from './strongEntityPresentation'
import { splitStrongLexicalRelations } from './strongLexiconRelations'
import { hasHiddenStrongPreviewItems } from './strongDetailPreview'
import { getScaledStrongTextStyle, type StrongReadingTypography } from './strongEditorialHtmlStyles'
import { formatStrongLemmaPartOfSpeech } from './strongLemmaPartOfSpeech'
import { isStrongOriginalUnnamed } from './strongOriginalPresentation'
import StrongPassageMediaSection from './StrongPassageMediaSection'
import { isSameStrongDefinition, presentStrongDefinitions } from './strongDefinitionPresentation'
type Anchor = 'context' | 'definition' | 'media' | 'entity' | 'related' | 'concordance'

type Props = {
  entry: StrongLexiconEntry
  extrasLoading?: boolean
  extrasError?: boolean
  onRetryExtras?: () => void
  passageMedia: ResolvedPassageMedia[]
  contextVerse?: Verse
  contextLoading?: boolean
  contextError?: boolean
  onRetryContext?: () => void
  contextReference?: string
  contextVersion?: string
  clickedWord?: string
  contextMorphologies?: StrongLexiconMorphology[]
  concordanceCount?: number
  concordanceTotalCount?: number
  concordanceVersion: string
  concordanceVerses: Verse[]
  concordanceLoading: boolean
  concordanceError: boolean
  concordanceRetrying: boolean
  onRetryConcordance: () => void
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
  highlight,
  untranslatedOffset,
  readingTypography,
}: {
  text: string
  highlight?: StrongContextHighlight
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
  if (!highlight)
    return <Text style={getScaledStrongTextStyle(18, 28, readingTypography)}>{text}</Text>

  return (
    <Text style={getScaledStrongTextStyle(20, 30, readingTypography)}>
      {text.slice(0, highlight.start)}
      <Text
        className="bg-light-primary text-primary font-bold rounded-[5px] px-[3px]"
        style={getScaledStrongTextStyle(20, 30, readingTypography)}
      >
        {text.slice(highlight.start, highlight.end)}
      </Text>
      {text.slice(highlight.end)}
    </Text>
  )
}

const DefinitionBlock = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <VStack className="overflow-hidden border-continuous gap-[8px] pt-[16px] mt-[4px] border-t-[1px] border-border">
    <Text className="font-bold text-[15px]">{title}</Text>
    {children}
  </VStack>
)

const JumpNavigationContent = ({
  anchors,
  onPress,
}: {
  anchors: { id: Anchor; label: string; visible: boolean }[]
  onPress: (anchor: Anchor) => void
}) => (
  <HorizontalControlScrollView
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
  </HorizontalControlScrollView>
)

const StrongDetailMainPage = ({
  entry,
  passageMedia,
  extrasLoading = false,
  extrasError = false,
  onRetryExtras,
  contextVerse,
  contextLoading = false,
  contextError = false,
  onRetryContext,
  contextReference,
  contextVersion,
  clickedWord,
  contextMorphologies = [],
  concordanceCount,
  concordanceTotalCount,
  concordanceVersion,
  concordanceVerses,
  concordanceLoading,
  concordanceError,
  concordanceRetrying,
  onRetryConcordance,
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
  const [storedLevel, setStoredLevel] = useAtom(strongDefinitionLevelAtom)
  const [contextDisclosure, setContextDisclosure] = useState<{ key: string; expanded: boolean }>()
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
  const definition = presentStrongDefinitions(entry)
  const lexicalRelations = splitStrongLexicalRelations(entry.relations)
  const displayedRelationCount = Math.min(lexicalRelations.relatedWords.length, 4)
  const displayedConcordanceCount = Math.min(concordanceVerses.length, 3)
  const isOriginalUnnamed = isStrongOriginalUnnamed(entry.original)
  const originalLabel = isOriginalUnnamed ? t('strongDetail.unnamedPerson') : entry.original
  const dictionaryResource = isOriginalUnnamed ? undefined : entry.resources[0]
  const nameMeaningHtml = [definition.essentialHtml, definition.deep?.html].some(html =>
    isSameStrongDefinition(html, entry.nameMeaningHtml)
  )
    ? undefined
    : entry.nameMeaningHtml
  const deepDefinitionTitle =
    definition.deep?.kind === 'general'
      ? t('strongDetail.definition.generalEntry')
      : t('strongDetail.definition.detailed')
  const hasDeepContent =
    Boolean(definition.deep || nameMeaningHtml || dictionaryResource) ||
    lexicalRelations.alternateSenses.length > 0
  const hasLevelChoice =
    hasDeepContent ||
    Boolean(contextReference) ||
    Boolean(contextVerse) ||
    extrasLoading ||
    extrasError
  const level = hasLevelChoice ? storedLevel : 'essential'
  const contextKey = JSON.stringify([entry.stepCode, contextReference, contextVersion, level])
  const contextExpanded =
    contextDisclosure?.key === contextKey ? contextDisclosure.expanded : level === 'deep'

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
        <PageContent className="gap-[11px]" style={{ maxWidth: 600 }}>
          <StrongEntryMetadata entry={entry} />
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
        <PageContent style={{ maxWidth: 600 }}>
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
                visible: true,
              },
            ]}
            onPress={scrollToAnchor}
          />
        </PageContent>
      </Box>

      {hasLevelChoice && (
        <PageContent className="mt-4" style={{ maxWidth: 600 }}>
          <StrongLevelSwitch
            options={[
              { value: 'essential', label: t('strongDetail.definition.level.essential') },
              { value: 'deep', label: t('strongDetail.definition.level.deep') },
            ]}
            value={level}
            onChange={nextLevel => {
              setStoredLevel(nextLevel)
              setContextDisclosure(undefined)
            }}
          />
        </PageContent>
      )}

      {(!!contextVerse || !!contextReference) && (
        <StrongEditorialSection
          title={t('strongDetail.context.title')}
          subtitle={[contextReference, contextVersion].filter(Boolean).join(' · ')}
          expanded={contextExpanded}
          onToggle={() => setContextDisclosure({ key: contextKey, expanded: !contextExpanded })}
          onLayout={event => setAnchor('context', event.nativeEvent.layout.y)}
        >
          <VStack className="overflow-hidden border-continuous border-l-[3px] pl-[17px] py-[5px] gap-[10px]">
            {contextVerse ? (
              <HighlightedVerse
                text={contextText ?? ''}
                highlight={getStrongContextHighlight(
                  contextVerse,
                  entry,
                  clickedWord || entry.gloss
                )}
                untranslatedOffset={untranslatedContextOffset}
                readingTypography={readingTypography}
              />
            ) : contextLoading ? (
              <Loading message={t('Chargement...')} />
            ) : contextError ? (
              <TouchableBox onPress={onRetryContext} accessibilityRole="button" className="py-3">
                <Text className="text-primary">{t('Réessayer')}</Text>
              </TouchableBox>
            ) : null}
            <VStack className="overflow-hidden border-continuous gap-[4px]">
              {level === 'deep' &&
                contextMorphologies.map(morphology => (
                  <Text className="text-tertiary text-[12px]" key={morphology.code}>
                    {formatStrongContextMorphology(morphology)}
                  </Text>
                ))}
              {level === 'deep' && !contextMorphologies.length && entry.morphology && (
                <Text className="text-tertiary text-[12px]">
                  {formatStrongContextMorphology(entry.morphology)}
                </Text>
              )}
            </VStack>
          </VStack>
        </StrongEditorialSection>
      )}

      <StrongEditorialSection
        title={t('strongDetail.definition.title')}
        onLayout={event => setAnchor('definition', event.nativeEvent.layout.y)}
      >
        {definition.essentialHtml ? (
          <StrongEditorialHtml
            value={definition.essentialHtml}
            onOpenBibleReference={onOpenBibleReference}
            onOpenStrong={onOpenStrong}
          />
        ) : (
          <Text className="text-tertiary">
            {t('strongLexicon.definitionUnavailable', { language: entry.language })}
          </Text>
        )}
        {level === 'deep' && (
          <>
            {definition.deep && (
              <DefinitionBlock title={deepDefinitionTitle}>
                <StrongEditorialHtml
                  value={definition.deep.html}
                  onOpenBibleReference={onOpenBibleReference}
                  onOpenStrong={onOpenStrong}
                />
              </DefinitionBlock>
            )}
            {nameMeaningHtml && (
              <DefinitionBlock title={t('strongDetail.definition.nameMeaning')}>
                <StrongEditorialHtml
                  value={nameMeaningHtml}
                  onOpenBibleReference={onOpenBibleReference}
                  onOpenStrong={onOpenStrong}
                />
              </DefinitionBlock>
            )}
            {lexicalRelations.alternateSenses.length > 0 && (
              <DefinitionBlock title={t('strongLexicon.otherMeanings')}>
                <VStack className="gap-[9px]">
                  {lexicalRelations.alternateSenses.map(relation => (
                    <StrongLexicalRelationCard
                      key={relation.stepCode}
                      relation={relation}
                      readingTypography={readingTypography}
                      onPress={() => onOpenStrong(relation.stepCode)}
                    />
                  ))}
                </VStack>
              </DefinitionBlock>
            )}
            {extrasLoading && <Loading message={t('Chargement...')} />}
            {extrasError && (
              <TouchableBox onPress={onRetryExtras} accessibilityRole="button" className="py-3">
                <Text className="text-primary">{t('Réessayer')}</Text>
              </TouchableBox>
            )}
            {dictionaryResource && (
              <DefinitionBlock title={t('strongDetail.definition.classicalGreek')}>
                <StrongEditorialPreview
                  value={dictionaryResource.contentHtml}
                  readingTypography={readingTypography}
                  numberOfLines={5}
                  onOpenBibleReference={onOpenBibleReference}
                  onOpenStrong={onOpenStrong}
                  onOverflowChange={overflows =>
                    setDictionaryPreview(current =>
                      current?.resourceId === dictionaryResource.id &&
                      current.overflows === overflows
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
              </DefinitionBlock>
            )}
          </>
        )}
      </StrongEditorialSection>

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
          <PageContent className="gap-[14px]" style={{ maxWidth: 600 }}>
            <StrongEntitySummaryCard
              entity={entry.entity}
              plain
              previewLines={4}
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
                {entry.entity.category !== 'person' && (
                  <Text className="font-bold text-[17px]">
                    {t('strongDetail.entity.relationships')}
                  </Text>
                )}
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

      <StrongEditorialSection
        title={t('Concordance')}
        onLayout={event => setAnchor('concordance', event.nativeEvent.layout.y)}
      >
        <HStack className="overflow-hidden border-continuous items-baseline gap-[8px]">
          <Text className="font-bold text-[26px]">{concordanceCount ?? '—'}</Text>
          <Text className="text-tertiary text-[14px]">
            {t('strongDetail.concordance.usesIn', { version: concordanceVersion })}
          </Text>
        </HStack>
        {lemmaStats.length > 0 && (
          <HorizontalControlScrollView
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
                  {t('Tous')} · {concordanceTotalCount ?? '—'}
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
                    {lemma.lemma} {formatStrongLemmaPartOfSpeech(lemma.partOfSpeech, i18n.language)}{' '}
                    · {lemma.occurrenceCount}
                  </Text>
                </Box>
              </TouchableBox>
            ))}
          </HorizontalControlScrollView>
        )}
        {concordanceLoading && <Loading />}
        {concordanceError && (
          <VStack className="gap-2 py-3">
            <Text accessibilityRole="alert" className="text-tertiary">
              {t('strongDetail.concordance.loadError')}
            </Text>
            <TouchableBox
              accessibilityRole="button"
              disabled={concordanceRetrying}
              onPress={onRetryConcordance}
            >
              <Text className="text-primary font-semibold">
                {t(concordanceRetrying ? 'Chargement...' : 'bible.error.retry')}
              </Text>
            </TouchableBox>
          </VStack>
        )}
        {!concordanceLoading && !concordanceError && concordanceCount === 0 && (
          <Text className="text-tertiary">{t('strongDetail.concordance.empty')}</Text>
        )}
        {concordanceVerses.length > 0 && (
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
        {(concordanceTotalCount == null ||
          concordanceError ||
          hasHiddenStrongPreviewItems(concordanceTotalCount, displayedConcordanceCount)) && (
          <StrongPreviewLink
            label={t('strongDetail.concordance.open')}
            onPress={() => onOpenPage('concordance')}
          />
        )}
      </StrongEditorialSection>
    </ScrollView>
  )
}

export default StrongDetailMainPage
