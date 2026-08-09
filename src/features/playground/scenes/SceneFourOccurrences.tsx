import type { TFunction } from 'i18next'
import { useEffect, useState } from 'react'
import { Pressable } from 'react-native'
import {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { runOnJS } from 'react-native-worklets'

import Box, { AnimatedBox, HStack, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import type { OnboardingStageMetrics } from '../onboarding/OnboardingStage'
import SceneBackgroundShape from '../onboarding/SceneBackgroundShape'
import SceneDecorativePluses from '../onboarding/SceneDecorativePluses'
import { Scene } from '../onboarding/SceneGraph'
import VerseCard, { type HighlightColor } from '../onboarding/VerseCard'

const OCCURRENCE_ENTER_START = 520
const OCCURRENCE_STAGGER = 120

export type OccurrenceFilterId = 'breath' | 'idol' | 'vanity'
export type OccurrenceFilterDirection = -1 | 1

type OccurrenceVerse = {
  after?: string
  before?: string
  highlight: string
  reference: string
}

const getOccurrenceVerses = (
  filter: OccurrenceFilterId,
  t: TFunction
): [OccurrenceVerse, OccurrenceVerse, OccurrenceVerse] => {
  if (filter === 'idol') {
    return [
      {
        reference: t('playground.sceneFour.idolDeuteronomyReference'),
        before: t('playground.sceneFour.idolDeuteronomyBefore'),
        highlight: t('playground.sceneFour.idolDeuteronomyHighlight'),
        after: t('playground.sceneFour.idolDeuteronomyAfter'),
      },
      {
        reference: t('playground.sceneFour.idolKingsReference'),
        before: t('playground.sceneFour.idolKingsBefore'),
        highlight: t('playground.sceneFour.idolKingsHighlight'),
        after: t('playground.sceneFour.idolKingsAfter'),
      },
      {
        reference: t('playground.sceneFour.idolPsalmsReference'),
        before: t('playground.sceneFour.idolPsalmsBefore'),
        highlight: t('playground.sceneFour.idolPsalmsHighlight'),
        after: t('playground.sceneFour.idolPsalmsAfter'),
      },
    ]
  }

  if (filter === 'breath') {
    return [
      {
        reference: t('playground.sceneFour.breathJobReference'),
        before: t('playground.sceneFour.breathJobBefore'),
        highlight: t('playground.sceneFour.breathJobHighlight'),
        after: t('playground.sceneFour.breathJobAfter'),
      },
      {
        reference: t('playground.sceneFour.breathPsalmThirtyNineReference'),
        before: t('playground.sceneFour.breathPsalmThirtyNineBefore'),
        highlight: t('playground.sceneFour.breathPsalmThirtyNineHighlight'),
        after: t('playground.sceneFour.breathPsalmThirtyNineAfter'),
      },
      {
        reference: t('playground.sceneFour.breathPsalmOneFortyFourReference'),
        before: t('playground.sceneFour.breathPsalmOneFortyFourBefore'),
        highlight: t('playground.sceneFour.breathPsalmOneFortyFourHighlight'),
        after: t('playground.sceneFour.breathPsalmOneFortyFourAfter'),
      },
    ]
  }

  return [
    {
      reference: t('playground.sceneFour.proverbsReference'),
      before: t('playground.sceneFour.proverbsBefore'),
      highlight: t('playground.sceneFour.proverbsHighlight'),
    },
    {
      reference: t('playground.sceneFour.jobReference'),
      before: t('playground.sceneFour.jobBefore'),
      highlight: t('playground.sceneFour.jobHighlight'),
      after: t('playground.sceneFour.jobAfter'),
    },
    {
      reference: t('playground.sceneFour.ecclesiastesReference'),
      before: t('playground.sceneFour.ecclesiastesHighlightOne'),
      highlight: t('playground.sceneFour.ecclesiastesHighlightTwo'),
      after: t('playground.sceneFour.ecclesiastesAfter'),
    },
  ]
}

type StrongLemmaCardProps = {
  metrics: OnboardingStageMetrics
  t: TFunction
}

const OccurrenceCounter = ({ metrics, t }: StrongLemmaCardProps) => {
  const s = metrics.s

  return (
    <HStack
      position="absolute"
      left={s(47)}
      bottom={s(-11)}
      width={s(110)}
      height={s(21)}
      bg="lightPrimary"
      borderRadius={s(11)}
      justifyContent="center"
      alignItems="center"
      gap={s(3)}
    >
      <Text title bold fontSize={s(9)} lineHeight={s(16)}>
        64
      </Text>
      <Text color="tertiary" bold fontSize={s(7)}>
        {t('playground.sceneFour.usageCount')}
      </Text>
    </HStack>
  )
}

const StrongLemmaCard = ({ metrics, t }: StrongLemmaCardProps) => {
  const s = metrics.s

  return (
    <VStack
      flex
      bg="reverse"
      borderRadius={s(26)}
      px={s(14)}
      py={s(10)}
      justifyContent="center"
      alignItems="center"
      gap={s(2)}
      style={{ boxShadow: '0 5px 16px rgba(59,92,204,0.13)' }}
      overflow="visible"
    >
      <Text color="primary" bold fontSize={s(9)} style={{ letterSpacing: s(1.1) }}>
        {t('playground.sceneFour.hebrew')}
      </Text>
      <Text
        fontSize={s(30)}
        lineHeight={s(36)}
        bold
        textAlign="center"
        style={{ writingDirection: 'rtl' }}
      >
        הֶבֶל
      </Text>
      <Text
        title
        color="primary"
        fontSize={s(21)}
        lineHeight={s(24)}
        style={{ fontFamily: 'Literata Book', fontStyle: 'italic' }}
      >
        hevel
      </Text>
      <Text color="tertiary" fontSize={s(9.5)} textAlign="center">
        {t('playground.sceneFour.lemmaDetails')}
      </Text>
      <OccurrenceCounter metrics={metrics} t={t} />
    </VStack>
  )
}

type OccurrenceFilterProps = {
  active?: boolean
  id: OccurrenceFilterId
  label: string
  metrics: OnboardingStageMetrics
  onPress: (filter: OccurrenceFilterId) => void
}

const OccurrenceFilter = ({
  active = false,
  id,
  label,
  metrics,
  onPress,
}: OccurrenceFilterProps) => (
  <Pressable
    accessibilityRole="button"
    accessibilityState={{ selected: active }}
    onPress={() => onPress(id)}
    hitSlop={metrics.s(4)}
    style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
  >
    <Box
      bg={active ? 'primary' : 'reverse'}
      borderRadius={metrics.s(14)}
      px={metrics.s(active ? 11 : 9)}
      py={metrics.s(6)}
      center
    >
      <Text color={active ? 'reverse' : 'tertiary'} bold fontSize={metrics.s(8.5)}>
        {label}
      </Text>
    </Box>
  </Pressable>
)

type OccurrenceFiltersProps = StrongLemmaCardProps & {
  activeFilter: OccurrenceFilterId
  onFilterChange: (filter: OccurrenceFilterId) => void
}

const OccurrenceFilters = ({
  activeFilter,
  metrics,
  onFilterChange,
  t,
}: OccurrenceFiltersProps) => (
  <HStack
    flex
    alignItems="center"
    justifyContent="center"
    gap={metrics.s(6)}
    bg="reverse"
    px={3}
    borderRadius={30}
    alignSelf="center"
    lightShadow
  >
    <OccurrenceFilter
      active={activeFilter === 'vanity'}
      id="vanity"
      label={t('playground.sceneFour.filterVanity')}
      metrics={metrics}
      onPress={onFilterChange}
    />
    <OccurrenceFilter
      active={activeFilter === 'idol'}
      id="idol"
      label={t('playground.sceneFour.filterIdol')}
      metrics={metrics}
      onPress={onFilterChange}
    />
    <OccurrenceFilter
      active={activeFilter === 'breath'}
      id="breath"
      label={t('playground.sceneFour.filterBreath')}
      metrics={metrics}
      onPress={onFilterChange}
    />
  </HStack>
)

type OccurrenceVerseCardProps = {
  contentKey: string
  direction: OccurrenceFilterDirection
  featured?: boolean
  markerLeft: number
  metrics: OnboardingStageMetrics
  reduceMotion: boolean
  reference: string
  travel: number
  children: React.ReactNode
}

type OccurrenceContent = {
  children: React.ReactNode
  key: string
  reference: string
}

const OccurrenceVerseCard = ({
  children,
  contentKey,
  direction,
  featured = false,
  markerLeft,
  metrics,
  reduceMotion,
  reference,
  travel,
}: OccurrenceVerseCardProps) => {
  const s = metrics.s
  const [currentContent, setCurrentContent] = useState<OccurrenceContent>({
    children,
    key: contentKey,
    reference,
  })
  const [previousContent, setPreviousContent] = useState<OccurrenceContent>()
  const transitionProgress = useSharedValue(1)
  const transitionDirection = useSharedValue<OccurrenceFilterDirection>(direction)
  const contentTravel = s(travel)

  useEffect(() => {
    if (currentContent.key === contentKey) return

    setPreviousContent(currentContent)
    setCurrentContent({ children, key: contentKey, reference })
    transitionDirection.set(direction)
    transitionProgress.set(0)
    transitionProgress.set(
      reduceMotion
        ? 1
        : withSpring(1, undefined, finished => {
            if (finished) runOnJS(setPreviousContent)(undefined)
          })
    )
    if (reduceMotion) setPreviousContent(undefined)
  }, [
    children,
    contentKey,
    currentContent,
    direction,
    reduceMotion,
    reference,
    transitionDirection,
    transitionProgress,
  ])

  const currentContentStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          transitionProgress.get(),
          [0, 1],
          [transitionDirection.get() * contentTravel, 0],
          Extrapolation.CLAMP
        ),
      },
    ],
  }))
  const previousContentStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          transitionProgress.get(),
          [0, 1],
          [0, -transitionDirection.get() * contentTravel],
          Extrapolation.CLAMP
        ),
      },
    ],
  }))

  const renderContent = (content: OccurrenceContent) => (
    <>
      <Text color="primary" bold fontSize={s(9)} style={{ letterSpacing: s(1.2) }}>
        {content.reference}
      </Text>
      <Text fontSize={s(featured ? 12.3 : 10.6)} lineHeight={s(featured ? 15.5 : 13.5)} mt={s(8)}>
        {content.children}
      </Text>
    </>
  )

  return (
    <Box
      flex
      bg="reverse"
      borderRadius={s(featured ? 22 : 18)}
      borderWidth={featured ? s(1.5) : 0}
      borderColor={featured ? 'primary' : undefined}
      style={{ boxShadow: '0 7px 18px rgba(59,92,204,0.11)', overflow: 'hidden' }}
    >
      <Box absoluteFill style={{ overflow: 'hidden' }}>
        {previousContent ? (
          <AnimatedBox
            position="absolute"
            left={s(featured ? 14 : 10)}
            right={s(featured ? 14 : 10)}
            top={s(featured ? 12 : 10)}
            bottom={s(featured ? 12 : 10)}
            pointerEvents="none"
            style={previousContentStyle}
          >
            {renderContent(previousContent)}
          </AnimatedBox>
        ) : null}
        <AnimatedBox
          position="absolute"
          left={s(featured ? 14 : 10)}
          right={s(featured ? 14 : 10)}
          top={s(featured ? 12 : 10)}
          bottom={s(featured ? 12 : 10)}
          pointerEvents="none"
          style={currentContentStyle}
        >
          {renderContent(currentContent)}
        </AnimatedBox>
      </Box>
    </Box>
  )
}

type CreateSceneFourOccurrencesProps = {
  activeFilter: OccurrenceFilterId
  filterDirection: OccurrenceFilterDirection
  highlightColor: HighlightColor
  metrics: OnboardingStageMetrics
  onFilterChange: (filter: OccurrenceFilterId) => void
  reduceMotion: boolean
  t: TFunction
}

export const createSceneFourOccurrences = ({
  activeFilter,
  filterDirection,
  highlightColor,
  metrics,
  onFilterChange,
  reduceMotion,
  t,
}: CreateSceneFourOccurrencesProps) => {
  const verses = getOccurrenceVerses(activeFilter, t)
  const renderVerse = (verse: OccurrenceVerse, fontSize: number) => (
    <>
      {verse.before}
      <Text color="primary" bold fontSize={metrics.s(fontSize)}>
        {verse.highlight}
      </Text>
      {verse.after}
    </>
  )
  return (
    <Scene id="scene-four">
      <Scene.Node
        id="scene-background"
        layout="resize"
        frame={{ x: 46, y: -9, width: 129, height: 133, opacity: 0.72, zIndex: 0 }}
        pointerEvents="none"
      >
        <SceneBackgroundShape borderRadius={metrics.s(67)} reduceMotion={reduceMotion} />
      </Scene.Node>

      <Scene.Node
        id="verse-card"
        layout="scale"
        frame={{
          x: -99,
          y: -59,
          width: 382,
          height: 294,
          scale: 0.38,
          rotation: -6,
          opacity: 0.5,
          zIndex: 2,
        }}
        draggable
        dragFriction={0.1}
      >
        <VerseCard
          mode="small"
          reduceMotion={reduceMotion}
          highlightColor={highlightColor}
          metrics={metrics}
        />
      </Scene.Node>

      <Scene.Node
        id="strong-stack"
        layout="resize"
        frame={{
          x: 73,
          y: 18,
          width: 204,
          height: 136,
          zIndex: 6,
          anchors: {
            bottomLeftBranch: { x: 0.46, y: 1 },
            bottomCenterBranch: { x: 0.5, y: 1 },
            bottomRightBranch: { x: 0.54, y: 1 },
          },
        }}
        draggable
        dragFriction={0.1}
      >
        <StrongLemmaCard metrics={metrics} t={t} />
      </Scene.Node>

      <Scene.Node
        id="occurrence-filters"
        frame={{ x: 20, y: 169, width: 310, height: 28, zIndex: 7 }}
        enterDelay={400}
        enterFrom={{ x: 0, y: -12 }}
        exitTo={{ x: 0, y: -12 }}
        pointerEvents="box-none"
      >
        <OccurrenceFilters
          activeFilter={activeFilter}
          metrics={metrics}
          onFilterChange={onFilterChange}
          t={t}
        />
      </Scene.Node>

      <Scene.Connection
        from={{ node: 'strong-stack', anchor: 'bottomLeftBranch' }}
        to={{ node: 'proverbs-occurrence', anchor: 'top' }}
        curve={{ type: 'quadratic', bend: 0.12 }}
        enterDelay={OCCURRENCE_ENTER_START}
        opacity={0.82}
        width={1.6}
      />
      <Scene.Connection
        from={{ node: 'strong-stack', anchor: 'bottomRightBranch' }}
        to={{ node: 'job-occurrence', anchor: 'top' }}
        curve={{ type: 'quadratic', bend: -0.12 }}
        enterDelay={OCCURRENCE_ENTER_START + OCCURRENCE_STAGGER}
        opacity={0.82}
        width={1.6}
      />
      <Scene.Connection
        from={{ node: 'strong-stack', anchor: 'bottomCenterBranch' }}
        to={{ node: 'ecclesiastes-occurrence', anchor: 'top' }}
        curve={{ type: 'quadratic', bend: 0.02 }}
        enterDelay={OCCURRENCE_ENTER_START + OCCURRENCE_STAGGER * 2}
        opacity={0.82}
        width={1.8}
      />

      <Scene.Node
        id="proverbs-occurrence"
        frame={{ x: 5, y: 249, width: 150, height: 81, rotation: -3, zIndex: 5 }}
        enterDelay={OCCURRENCE_ENTER_START}
        enterFrom={{ x: 28, y: -28 }}
        exitTo={{ x: 28, y: -28 }}
        draggable
        dragFriction={0.1}
      >
        <OccurrenceVerseCard
          contentKey={activeFilter}
          direction={filterDirection}
          markerLeft={75}
          metrics={metrics}
          reduceMotion={reduceMotion}
          reference={verses[0].reference}
          travel={150}
        >
          {renderVerse(verses[0], 10.6)}
        </OccurrenceVerseCard>
      </Scene.Node>

      <Scene.Node
        id="job-occurrence"
        frame={{ x: 194, y: 248, width: 151, height: 94, rotation: 3, zIndex: 4 }}
        enterDelay={OCCURRENCE_ENTER_START + OCCURRENCE_STAGGER}
        enterFrom={{ x: -28, y: -28 }}
        exitTo={{ x: -28, y: -28 }}
        draggable
        dragFriction={0.1}
      >
        <OccurrenceVerseCard
          contentKey={activeFilter}
          direction={filterDirection}
          markerLeft={75.5}
          metrics={metrics}
          reduceMotion={reduceMotion}
          reference={verses[1].reference}
          travel={151}
        >
          {renderVerse(verses[1], 10.6)}
        </OccurrenceVerseCard>
      </Scene.Node>

      <Scene.Node
        id="ecclesiastes-occurrence"
        frame={{ x: 41, y: 332, width: 268, height: 106, zIndex: 5 }}
        enterDelay={OCCURRENCE_ENTER_START + OCCURRENCE_STAGGER * 2}
        enterFrom={{ x: 0, y: -30 }}
        exitTo={{ x: 0, y: -30 }}
        draggable
        dragFriction={0.1}
      >
        <OccurrenceVerseCard
          contentKey={activeFilter}
          direction={filterDirection}
          featured
          markerLeft={134}
          metrics={metrics}
          reduceMotion={reduceMotion}
          reference={verses[2].reference}
          travel={268}
        >
          {activeFilter === 'vanity' ? (
            <>
              <Text color="primary" bold fontSize={metrics.s(12.3)}>
                {t('playground.sceneFour.ecclesiastesHighlightOne')}
              </Text>
              {t('playground.sceneFour.ecclesiastesMiddle')}
              <Text color="primary" bold fontSize={metrics.s(12.3)}>
                {verses[2].highlight}
              </Text>
              {verses[2].after}
            </>
          ) : (
            renderVerse(verses[2], 12.3)
          )}
        </OccurrenceVerseCard>
      </Scene.Node>

      <SceneDecorativePluses metrics={metrics} reduceMotion={reduceMotion} scene="four" />
    </Scene>
  )
}
