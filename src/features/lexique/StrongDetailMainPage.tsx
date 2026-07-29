import React, { useRef, useState } from 'react'
import { ScrollView, type ScrollView as ScrollViewType } from 'react-native'
import { useTranslation } from 'react-i18next'

import Loading from '~common/Loading'
import Box, { HStack, TouchableBox, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import ConcordanceVerse from '~features/bible/ConcordanceVerse'
import ListenToStrong from '~features/bible/ListenStrong'
import type {
  StrongLexiconEntry,
  StrongLexiconEntityRelation,
  StrongLexiconMorphology,
} from '~features/resources/strongLexiconAccess'
import type { StrongBibleLemmaStat } from '~helpers/strongBibleSidecar'
import type { StrongLexiconModuleAvailability } from '~helpers/strongLexiconModules'
import type { StrongReference, Verse } from '~common/types'
import StrongLexiconModuleCard from './StrongLexiconModuleCard'
import {
  StrongEditorialHtml,
  StrongEditorialPreview,
  StrongEditorialSection,
  StrongEntityRelationGraph,
  StrongEntityRelationList,
  StrongEntitySummaryCard,
  StrongLexicalRelationCard,
  StrongPreviewLink,
  StrongReferenceCloud,
} from './StrongDetailUI'
import {
  formatStrongContextMorphology,
  getStrongContextVerseText,
} from './strongContextPresentation'
import { splitStrongEntityRelations } from './strongEntityPresentation'

type Anchor = 'context' | 'definition' | 'entity' | 'related' | 'concordance'

type Props = {
  entry: StrongLexiconEntry
  legacyEntry: StrongReference
  contextVerse?: Verse
  contextReference?: string
  contextVersion?: string
  clickedWord?: string
  contextMorphologies?: StrongLexiconMorphology[]
  resourcesAvailability: StrongLexiconModuleAvailability
  entitiesAvailability: StrongLexiconModuleAvailability
  concordanceCount: number
  concordanceVersion: string
  concordanceVerses: Verse[]
  concordanceLoading: boolean
  lemmaStats: StrongBibleLemmaStat[]
  selectedLemmaId?: number
  readingFontFamily: string
  onSelectLemma: (lemmaId?: number) => void
  onOpenPage: (page: 'entity' | 'dictionary' | 'related' | 'concordance') => void
  onOpenStrong: (stepCode: string) => void
  onOpenBibleReference: (osis: string) => void
  onOpenConcordanceVerse: (verse: Verse) => void
  onOpenEntityRelation: (relation: StrongLexiconEntityRelation) => void
}

const HighlightedVerse = ({
  text,
  word,
  readingFontFamily,
}: {
  text: string
  word?: string
  readingFontFamily: string
}) => {
  if (!word)
    return (
      <Text fontSize={18} lineHeight={28} style={{ fontFamily: readingFontFamily }}>
        {text}
      </Text>
    )
  const index = text.toLocaleLowerCase().indexOf(word.toLocaleLowerCase())
  if (index < 0)
    return (
      <Text fontSize={18} lineHeight={28} style={{ fontFamily: readingFontFamily }}>
        {text}
      </Text>
    )

  return (
    <Text fontSize={20} lineHeight={30} style={{ fontFamily: readingFontFamily }}>
      {text.slice(0, index)}
      <Text
        bg="lightPrimary"
        color="primary"
        bold
        fontSize={20}
        borderRadius={5}
        px={3}
        style={{ fontFamily: readingFontFamily }}
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
        <TouchableBox key={anchor.id} onPress={() => onPress(anchor.id)} activeOpacity={0.7}>
          <Box bg="lightGrey" borderRadius={16} px={10} py={7}>
            <Text fontSize={12} bold>
              {anchor.label}
            </Text>
          </Box>
        </TouchableBox>
      ))}
  </ScrollView>
)

const StrongDetailMainPage = ({
  entry,
  legacyEntry,
  contextVerse,
  contextReference,
  contextVersion,
  clickedWord,
  contextMorphologies = [],
  resourcesAvailability,
  entitiesAvailability,
  concordanceCount,
  concordanceVersion,
  concordanceVerses,
  concordanceLoading,
  lemmaStats,
  selectedLemmaId,
  readingFontFamily,
  onSelectLemma,
  onOpenPage,
  onOpenStrong,
  onOpenBibleReference,
  onOpenConcordanceVerse,
  onOpenEntityRelation,
}: Props) => {
  const { t } = useTranslation()
  const scrollRef = useRef<ScrollViewType>(null)
  const [anchorOffsets, setAnchorOffsets] = useState<Partial<Record<Anchor, number>>>({})
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
  const contextText = contextVerse
    ? getStrongContextVerseText(contextVerse, entry, clickedWord)
    : undefined

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1 }}
      stickyHeaderIndices={[1]}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 0, paddingBottom: 90 }}
    >
      <VStack
        mx={-20}
        px={20}
        pt={28}
        pb={24}
        gap={11}
        bg="primary"
        bgOpacity="010"
        borderBottomWidth={1}
        borderColor="border"
      >
        <Text color="primary" bold fontSize={12} textTransform="uppercase">
          {entry.stepCode}
        </Text>
        <HStack alignItems="flex-end" gap={16}>
          <VStack flex gap={5}>
            <Text
              fontSize={40}
              lineHeight={45}
              fontWeight="400"
              style={{ fontFamily: readingFontFamily }}
            >
              {entry.original}
            </Text>
            <Text fontWeight="500" fontSize={25}>
              {entry.gloss}
            </Text>
            <Text color="tertiary" fontSize={14}>
              {[entry.transliteration, entry.pronunciation].filter(Boolean).join(' · ')}
            </Text>
          </VStack>
          <Box
            bg="lightPrimary"
            borderRadius={24}
            borderWidth={1}
            borderColor="primary"
            size={48}
            center
          >
            <ListenToStrong
              type={entry.language === 'hebrew' ? 'hebreu' : 'grec'}
              code={entry.baseCode}
            />
          </Box>
        </HStack>
      </VStack>

      <Box
        mx={-20}
        py={10}
        bg="reverse"
        borderBottomWidth={1}
        borderTopWidth={1}
        borderColor="border"
        zIndex={10}
      >
        <JumpNavigationContent
          anchors={[
            {
              id: 'context',
              label: t('strongDetail.jump.context'),
              visible: Boolean(contextVerse),
            },
            { id: 'definition', label: t('strongDetail.jump.definition'), visible: true },
            { id: 'entity', label: entityLabel, visible: Boolean(entry.entity) },
            {
              id: 'related',
              label: t('strongDetail.jump.related'),
              visible: entry.relations.length > 0,
            },
            { id: 'concordance', label: t('Concordance'), visible: true },
          ]}
          onPress={scrollToAnchor}
        />
      </Box>

      {!!contextVerse && (
        <StrongEditorialSection
          title={t('strongDetail.context.title')}
          onLayout={event => setAnchor('context', event.nativeEvent.layout.y)}
        >
          <VStack borderLeftWidth={3} borderLeftColor="primary" pl={17} py={5} gap={10}>
            <HighlightedVerse
              text={contextText ?? ''}
              word={clickedWord || entry.gloss}
              readingFontFamily={readingFontFamily}
            />
            <VStack gap={4}>
              <Text color="tertiary" fontSize={12}>
                {[contextReference, contextVersion].filter(Boolean).join(' · ')}
              </Text>
              {contextMorphologies.map(morphology => (
                <Text key={morphology.code} color="tertiary" fontSize={12}>
                  {formatStrongContextMorphology(morphology)}
                </Text>
              ))}
              {!contextMorphologies.length && entry.morphology && (
                <Text color="tertiary" fontSize={12}>
                  {formatStrongContextMorphology(entry.morphology)}
                </Text>
              )}
            </VStack>
          </VStack>
        </StrongEditorialSection>
      )}

      {!!contextVerse && <Box width={42} height={3} bg="default" mt={34} mb={2} />}

      <StrongEditorialSection
        title={t('strongDetail.definition.title')}
        onLayout={event => setAnchor('definition', event.nativeEvent.layout.y)}
      >
        {entry.definitionHtml ? (
          <StrongEditorialHtml
            value={entry.definitionHtml}
            readingFontFamily={readingFontFamily}
            onOpenBibleReference={onOpenBibleReference}
            onOpenStrong={onOpenStrong}
          />
        ) : (
          <Text color="tertiary">
            {t('strongLexicon.definitionUnavailable', {
              language: entry.language,
            })}
          </Text>
        )}
      </StrongEditorialSection>

      {entry.resources.length > 0 ? (
        <StrongEditorialSection title={t('strongDetail.dictionary.light')}>
          <Text color="tertiary" fontSize={12}>
            {entry.resources[0].source} · {entry.resources[0].title}
          </Text>
          <StrongEditorialPreview
            value={entry.resources[0].contentHtml}
            readingFontFamily={readingFontFamily}
            numberOfLines={5}
          />
          <StrongPreviewLink
            label={t('strongDetail.dictionary.open')}
            onPress={() => onOpenPage('dictionary')}
          />
        </StrongEditorialSection>
      ) : resourcesAvailability.status !== 'available' && entry.language === 'greek' ? (
        <StrongEditorialSection title={t('strongDetail.dictionary.light')}>
          <StrongLexiconModuleCard
            moduleId="resources"
            availability={resourcesAvailability}
            title={t('strongLexicon.greekDictionary')}
            description={t('strongLexicon.greekDictionaryDescription')}
          />
        </StrongEditorialSection>
      ) : null}

      {!!entry.entity ? (
        <VStack
          mx={-20}
          mt={30}
          px={20}
          pt={22}
          pb={26}
          bg="lightGrey"
          borderTopWidth={1}
          borderBottomWidth={1}
          borderColor="border"
          gap={14}
          onLayout={event => setAnchor('entity', event.nativeEvent.layout.y)}
        >
          <StrongEntitySummaryCard
            entity={entry.entity}
            plain
            onOpenBibleReference={onOpenBibleReference}
            onOpenStrong={onOpenStrong}
          />
          {!!entityRelations?.graph.length && (
            <VStack mt={7} gap={10}>
              <Text bold fontSize={17}>
                {t('strongDetail.entity.personalRelationships')}
              </Text>
              <StrongEntityRelationGraph
                entity={entry.entity}
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
          {entry.entity.references.length > 0 && (
            <VStack mt={7} gap={10}>
              <HStack justifyContent="space-between" alignItems="baseline" gap={12}>
                <Text bold fontSize={17}>
                  {t('strongDetail.entity.firstReferences')}
                </Text>
                <Text color="tertiary" fontSize={11}>
                  {t('strongDetail.entity.totalReferences', {
                    count: entry.entity.references.length + entry.entity.hiddenReferenceCount,
                  })}
                </Text>
              </HStack>
              <StrongReferenceCloud
                references={entry.entity.references}
                hiddenCount={entry.entity.hiddenReferenceCount}
                limit={10}
                onOpenReference={onOpenBibleReference}
              />
            </VStack>
          )}
          <StrongPreviewLink
            label={t('strongDetail.entity.open', { name: entry.entity.name })}
            onPress={() => onOpenPage('entity')}
          />
        </VStack>
      ) : entitiesAvailability.status !== 'available' ? (
        <StrongEditorialSection title={t('strongDetail.entity.context')} separated>
          <StrongLexiconModuleCard
            moduleId="entities"
            availability={entitiesAvailability}
            title={t('strongLexicon.biblicalEntities')}
            description={t('strongLexicon.biblicalEntitiesDescription')}
          />
        </StrongEditorialSection>
      ) : null}

      {entry.relations.length > 0 && (
        <StrongEditorialSection
          title={t('strongDetail.related.title')}
          onLayout={event => setAnchor('related', event.nativeEvent.layout.y)}
        >
          <VStack gap={9}>
            {entry.relations.slice(0, 4).map(relation => (
              <StrongLexicalRelationCard
                key={`${relation.stepCode}:${relation.label}`}
                relation={relation}
                readingFontFamily={readingFontFamily}
                onPress={() => onOpenStrong(relation.stepCode)}
              />
            ))}
          </VStack>
          <StrongPreviewLink
            label={t('strongDetail.related.open')}
            onPress={() => onOpenPage('related')}
          />
        </StrongEditorialSection>
      )}

      <StrongEditorialSection
        title={t('Concordance')}
        onLayout={event => setAnchor('concordance', event.nativeEvent.layout.y)}
      >
        <HStack alignItems="baseline" gap={8}>
          <Text bold fontSize={30}>
            {concordanceCount}
          </Text>
          <Text color="tertiary" fontSize={12}>
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
            <TouchableBox onPress={() => onSelectLemma(undefined)}>
              <Box
                bg={selectedLemmaId == null ? 'primary' : 'lightGrey'}
                borderRadius={16}
                px={10}
                py={7}
              >
                <Text color={selectedLemmaId == null ? 'reverse' : 'default'} fontSize={12}>
                  {t('Tous')} · {concordanceCount}
                </Text>
              </Box>
            </TouchableBox>
            {lemmaStats.map(lemma => (
              <TouchableBox key={lemma.id} onPress={() => onSelectLemma(lemma.id)}>
                <Box
                  bg={selectedLemmaId === lemma.id ? 'primary' : 'lightGrey'}
                  borderRadius={16}
                  px={10}
                  py={7}
                >
                  <Text color={selectedLemmaId === lemma.id ? 'reverse' : 'default'} fontSize={12}>
                    {lemma.lemma} · {lemma.occurrenceCount}
                  </Text>
                </Box>
              </TouchableBox>
            ))}
          </ScrollView>
        )}
        {concordanceLoading ? (
          <Loading />
        ) : (
          <VStack>
            {concordanceVerses.slice(0, 3).map(verse => (
              <ConcordanceVerse
                key={`${verse.Livre}-${verse.Chapitre}-${verse.Verset}`}
                onOpenVerse={onOpenConcordanceVerse}
                t={t}
                concordanceFor={String(entry.baseCode)}
                lexiconEntry={legacyEntry}
                verse={verse}
              />
            ))}
          </VStack>
        )}
        <StrongPreviewLink
          label={t('strongDetail.concordance.open')}
          onPress={() => onOpenPage('concordance')}
        />
      </StrongEditorialSection>
    </ScrollView>
  )
}

export default StrongDetailMainPage
