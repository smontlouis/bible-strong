import HorizontalControlScrollView from '~common/HorizontalControlScrollView'
import StrongEntryMetadata from './StrongEntryMetadata'
import { twMerge } from '~common/ui/classNames'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import { resolveUniverseColors } from '~themes/universeColors'
import PageContent from '~common/ui/PageContent'
import IconTile from '~common/ui/IconTile'
import LexiqueIcon from '~common/LexiqueIcon'
import { useAtom } from 'jotai/react'
import React, { useRef, useState } from 'react'
import { ScrollView, type ScrollView as ScrollViewType } from 'react-native'
import { useTranslation } from 'react-i18next'
import Loading from '~common/Loading'
import Box, { HStack, TouchableBox, VStack, usePageBottomInset } from '~common/ui/Box'
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
import { formatStrongDisplayCode, getStrongReferenceNumber } from '~helpers/strongIdentities'
import type { Verse } from '~common/types'
import {
  StrongEditorialHtml,
  StrongEditorialPreview,
  StrongEntityRelationList,
  StrongEntitySummaryCard,
  StrongLexicalRelationRow,
} from './StrongDetailUI'
import {
  STUDY_COLUMN_MAX_WIDTH,
  StudyCardBody,
  StudyMoreRow,
  StudyRowsCard,
  StudySection,
} from '~common/ui/StudySection'
import SegmentedControl from '~common/ui/SegmentedControl'
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
import {
  isSameStrongDefinition,
  presentStrongDefinitions,
} from '@bible-strong/resource-domain/strong-definition-presentation'
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
        className="bg-light-primary text-primary font-bold rounded-[4px] px-[3px]"
        style={getScaledStrongTextStyle(20, 30, readingTypography)}
      >
        {text.slice(highlight.start, highlight.end)}
      </Text>
      {text.slice(highlight.end)}
    </Text>
  )
}

/** A part of the definition card, under a hairline: its title, then its text or its rows. */
const DefinitionBlock = ({
  title,
  children,
  rows = false,
}: {
  title: string
  children: React.ReactNode
  /** Rows set their own margin: the block only pads its title. */
  rows?: boolean
}) =>
  rows ? (
    <VStack className="pt-[14px]">
      <Text accessibilityRole="header" className="text-[13px] text-grey px-[16px] pb-[2px]">
        {title}
      </Text>
      {children}
    </VStack>
  ) : (
    <StudyCardBody className="gap-[8px]">
      <Text accessibilityRole="header" className="text-[13px] text-grey">
        {title}
      </Text>
      {children}
    </StudyCardBody>
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
    contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
  >
    {anchors
      .filter(anchor => anchor.visible)
      .map(anchor => (
        <TouchableBox
          className="overflow-hidden border-continuous bg-surface rounded-full px-[12px] py-[6px]"
          key={anchor.id}
          onPress={() => onPress(anchor.id)}
          activeOpacity={0.7}
        >
          <Text className="text-[13px]">{anchor.label}</Text>
        </TouchableBox>
      ))}
  </HorizontalControlScrollView>
)

/** A lemma filter of the concordance; the chips sit on the canvas. */
const LemmaChip = ({
  label,
  selected,
  onPress,
}: {
  label: string
  selected: boolean
  onPress: () => void
}) => (
  <TouchableBox
    className={twMerge(
      'overflow-hidden border-continuous rounded-full px-[12px] py-[6px]',
      selected ? 'bg-primary' : 'bg-surface'
    )}
    accessibilityState={{ selected }}
    onPress={onPress}
  >
    <Text className={twMerge('text-[13px]', selected && 'text-reverse font-semibold')}>
      {label}
    </Text>
  </TouchableBox>
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
  const bottomInset = usePageBottomInset()
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
  const strongUniverse = resolveUniverseColors(stylingTheme.colors, 'strong')
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
  const isDeep = level === 'deep'
  const dictionaryOverflows =
    !!dictionaryResource &&
    dictionaryPreview?.resourceId === dictionaryResource.id &&
    dictionaryPreview.overflows

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1 }}
      stickyHeaderIndices={[1]}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: 0,
        paddingBottom: 90 + bottomInset,
      }}
    >
      <PageContent
        className="pt-[22px] pb-[18px] gap-[10px]"
        style={{ maxWidth: STUDY_COLUMN_MAX_WIDTH }}
      >
        <StrongEntryMetadata entry={entry} />
        <HStack className="items-center gap-[10px]">
          <IconTile bg={strongUniverse.background}>
            <LexiqueIcon size={18} color={strongUniverse.foreground} />
          </IconTile>
          <Text className="text-[15px] text-grey">{formatStrongDisplayCode(entry.stepCode)}</Text>
        </HStack>
        <HStack className="overflow-hidden border-continuous items-end gap-[16px]">
          <VStack className="overflow-hidden border-continuous flex-[1] gap-[4px]">
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
            <Text className="font-medium text-[24px]">{entry.gloss}</Text>
            {!isOriginalUnnamed && (entry.transliteration || entry.pronunciation) && (
              <Text className="text-grey text-[14px]">
                {[entry.transliteration, entry.pronunciation].filter(Boolean).join(' · ')}
              </Text>
            )}
          </VStack>
          {!isOriginalUnnamed &&
            hasStrongAudio(entry.language === 'hebrew' ? 'hebreu' : 'grec', entry.baseCode) && (
              <Box
                className="overflow-hidden border-continuous rounded-full items-center justify-center"
                style={{ backgroundColor: strongUniverse.background, width: 48, height: 48 }}
              >
                <ListenToStrong
                  type={entry.language === 'hebrew' ? 'hebreu' : 'grec'}
                  code={entry.baseCode}
                />
              </Box>
            )}
        </HStack>
      </PageContent>

      <Box className="overflow-hidden border-continuous mx-[-20px] py-[8px] bg-canvas z-[10]">
        <PageContent style={{ maxWidth: STUDY_COLUMN_MAX_WIDTH + 40 }}>
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
        <PageContent className="mt-[10px]" style={{ maxWidth: STUDY_COLUMN_MAX_WIDTH }}>
          <SegmentedControl
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
        <StudySection
          title={t('strongDetail.context.title')}
          subtitle={[contextReference, contextVersion].filter(Boolean).join(' · ')}
          expanded={contextExpanded}
          onToggle={() => setContextDisclosure({ key: contextKey, expanded: !contextExpanded })}
          onLayout={event => setAnchor('context', event.nativeEvent.layout.y)}
        >
          {contextVerse ? (
            <HighlightedVerse
              text={contextText ?? ''}
              highlight={getStrongContextHighlight(contextVerse, entry, clickedWord || entry.gloss)}
              untranslatedOffset={untranslatedContextOffset}
              readingTypography={readingTypography}
            />
          ) : contextLoading ? (
            <Loading message={t('Chargement...')} />
          ) : contextError ? (
            <TouchableBox onPress={onRetryContext} accessibilityRole="button" className="py-[4px]">
              <Text className="text-primary">{t('Réessayer')}</Text>
            </TouchableBox>
          ) : null}
          {isDeep && (contextMorphologies.length > 0 || !!entry.morphology) && (
            <VStack className="gap-[4px]">
              {contextMorphologies.map(morphology => (
                <Text className="text-grey text-[13px]" key={morphology.code}>
                  {formatStrongContextMorphology(morphology)}
                </Text>
              ))}
              {!contextMorphologies.length && entry.morphology && (
                <Text className="text-grey text-[13px]">
                  {formatStrongContextMorphology(entry.morphology)}
                </Text>
              )}
            </VStack>
          )}
        </StudySection>
      )}

      <StudySection
        title={t('strongDetail.definition.title')}
        surface="rows"
        onLayout={event => setAnchor('definition', event.nativeEvent.layout.y)}
      >
        <StudyCardBody>
          {definition.essentialHtml ? (
            <StrongEditorialHtml
              selectable
              value={definition.essentialHtml}
              onOpenBibleReference={onOpenBibleReference}
              onOpenStrong={onOpenStrong}
            />
          ) : (
            <Text className="text-grey">
              {t('strongLexicon.definitionUnavailable', { language: entry.language })}
            </Text>
          )}
        </StudyCardBody>
        {isDeep && definition.deep && (
          <DefinitionBlock title={deepDefinitionTitle}>
            <StrongEditorialHtml
              selectable
              value={definition.deep.html}
              onOpenBibleReference={onOpenBibleReference}
              onOpenStrong={onOpenStrong}
            />
          </DefinitionBlock>
        )}
        {isDeep && nameMeaningHtml && (
          <DefinitionBlock title={t('strongDetail.definition.nameMeaning')}>
            <StrongEditorialHtml
              selectable
              value={nameMeaningHtml}
              onOpenBibleReference={onOpenBibleReference}
              onOpenStrong={onOpenStrong}
            />
          </DefinitionBlock>
        )}
        {isDeep && lexicalRelations.alternateSenses.length > 0 && (
          <DefinitionBlock title={t('strongLexicon.otherMeanings')} rows>
            {lexicalRelations.alternateSenses.map(relation => (
              <StrongLexicalRelationRow
                key={relation.stepCode}
                relation={relation}
                readingTypography={readingTypography}
                onPress={() => onOpenStrong(relation.stepCode)}
              />
            ))}
          </DefinitionBlock>
        )}
        {isDeep && (extrasLoading || extrasError) && (
          <StudyCardBody>
            {extrasLoading && <Loading message={t('Chargement...')} />}
            {extrasError && (
              <TouchableBox onPress={onRetryExtras} accessibilityRole="button" className="py-[4px]">
                <Text className="text-primary">{t('Réessayer')}</Text>
              </TouchableBox>
            )}
          </StudyCardBody>
        )}
        {isDeep && dictionaryResource && (
          <DefinitionBlock title={t('strongDetail.definition.classicalGreek')}>
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
          </DefinitionBlock>
        )}
        {isDeep && dictionaryOverflows && (
          <StudyMoreRow
            label={t('strongDetail.dictionary.open')}
            onPress={() => onOpenPage('dictionary')}
          />
        )}
      </StudySection>

      {passageMedia.length > 0 && (
        <StrongPassageMediaSection
          media={passageMedia}
          title={t('strongDetail.media.title')}
          onLayout={event => setAnchor('media', event.nativeEvent.layout.y)}
        />
      )}

      {!!entry.entity && (
        <StudySection
          title={entityLabel}
          surface="none"
          onLayout={event => setAnchor('entity', event.nativeEvent.layout.y)}
        >
          <StudyRowsCard>
            <StudyCardBody>
              <StrongEntitySummaryCard
                entity={entry.entity}
                plain
                showsKind={false}
                previewLines={4}
                readingTypography={readingTypography}
                onOpenBibleReference={onOpenBibleReference}
                onOpenStrong={onOpenStrong}
              />
            </StudyCardBody>
            <StudyMoreRow
              label={t('strongDetail.entity.open')}
              onPress={() => onOpenPage('entity')}
            />
          </StudyRowsCard>
          {!!entityRelations?.graph.length && (
            <StrongEntityRelationGraph
              entity={entry.entity}
              onOpenProfile={onOpenEntityProfile}
              onOpenEntity={onOpenEntityRelation}
            />
          )}
          {!!entityRelations?.remaining.length && (
            <StrongEntityRelationList
              relations={entityRelations.remaining}
              onOpenEntity={onOpenEntityRelation}
            />
          )}
        </StudySection>
      )}

      {lexicalRelations.relatedWords.length > 0 && (
        <StudySection
          title={t('strongDetail.related.title')}
          surface="rows"
          onLayout={event => setAnchor('related', event.nativeEvent.layout.y)}
        >
          {lexicalRelations.relatedWords.slice(0, displayedRelationCount).map(relation => (
            <StrongLexicalRelationRow
              key={relation.stepCode}
              relation={relation}
              readingTypography={readingTypography}
              onPress={() => onOpenStrong(relation.stepCode)}
            />
          ))}
          {hasHiddenStrongPreviewItems(
            lexicalRelations.relatedWords.length,
            displayedRelationCount
          ) && (
            <StudyMoreRow
              label={t('strongDetail.related.open')}
              onPress={() => onOpenPage('related')}
            />
          )}
        </StudySection>
      )}

      <StudySection
        title={t('Concordance')}
        surface="none"
        onLayout={event => setAnchor('concordance', event.nativeEvent.layout.y)}
      >
        <HStack className="overflow-hidden border-continuous items-baseline gap-[8px] px-[4px]">
          <Text className="font-semibold text-[26px]">{concordanceCount ?? '—'}</Text>
          <Text className="text-grey text-[14px]">
            {t('strongDetail.concordance.usesIn', { version: concordanceVersion })}
          </Text>
        </HStack>
        {lemmaStats.length > 0 && (
          <HorizontalControlScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -20 }}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
          >
            <LemmaChip
              label={`${t('Tous')} · ${concordanceTotalCount ?? '—'}`}
              selected={selectedLemmaId == null}
              onPress={() => onSelectLemma(undefined)}
            />
            {lemmaStats.map(lemma => (
              <LemmaChip
                key={lemma.id}
                label={`${lemma.lemma} ${formatStrongLemmaPartOfSpeech(lemma.partOfSpeech, i18n.language)} · ${lemma.occurrenceCount}`}
                selected={selectedLemmaId === lemma.id}
                onPress={() => onSelectLemma(lemma.id)}
              />
            ))}
          </HorizontalControlScrollView>
        )}
        <StudyRowsCard>
          {concordanceLoading && (
            <StudyCardBody>
              <Loading />
            </StudyCardBody>
          )}
          {concordanceError && (
            <StudyCardBody className="gap-[8px]">
              <Text accessibilityRole="alert" className="text-grey">
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
            </StudyCardBody>
          )}
          {!concordanceLoading && !concordanceError && concordanceCount === 0 && (
            <StudyCardBody>
              <Text className="text-grey">{t('strongDetail.concordance.empty')}</Text>
            </StudyCardBody>
          )}
          {concordanceVerses.slice(0, displayedConcordanceCount).map(verse => (
            <ConcordanceVerse
              key={`${verse.Livre}-${verse.Chapitre}-${verse.Verset}`}
              className="px-[16px] py-[12px]"
              separated={false}
              onOpenVerse={onOpenConcordanceVerse}
              t={t}
              concordanceFor={String(entry.baseCode)}
              verse={verse}
            />
          ))}
          {(concordanceTotalCount == null ||
            concordanceError ||
            hasHiddenStrongPreviewItems(concordanceTotalCount, displayedConcordanceCount)) && (
            <StudyMoreRow
              label={t('strongDetail.concordance.open')}
              onPress={() => onOpenPage('concordance')}
            />
          )}
        </StudyRowsCard>
      </StudySection>
    </ScrollView>
  )
}

export default StrongDetailMainPage
