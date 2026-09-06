import { twMerge } from '~common/ui/classNames'
import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
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
import type { OnboardingStageMetrics } from '../OnboardingStage'
import SceneBackgroundShape from '../SceneBackgroundShape'
import SceneActionButton from '../SceneActionButton'
import SceneDecorativePluses from '../SceneDecorativePluses'
import { Scene } from '../SceneGraph'
import VerseCard, { type HighlightColor } from '../VerseCard'
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
        reference: t('onboarding.abel.sceneFour.idolDeuteronomyReference'),
        before: t('onboarding.abel.sceneFour.idolDeuteronomyBefore'),
        highlight: t('onboarding.abel.sceneFour.idolDeuteronomyHighlight'),
        after: t('onboarding.abel.sceneFour.idolDeuteronomyAfter'),
      },
      {
        reference: t('onboarding.abel.sceneFour.idolKingsReference'),
        before: t('onboarding.abel.sceneFour.idolKingsBefore'),
        highlight: t('onboarding.abel.sceneFour.idolKingsHighlight'),
        after: t('onboarding.abel.sceneFour.idolKingsAfter'),
      },
      {
        reference: t('onboarding.abel.sceneFour.idolPsalmsReference'),
        before: t('onboarding.abel.sceneFour.idolPsalmsBefore'),
        highlight: t('onboarding.abel.sceneFour.idolPsalmsHighlight'),
        after: t('onboarding.abel.sceneFour.idolPsalmsAfter'),
      },
    ]
  }

  if (filter === 'breath') {
    return [
      {
        reference: t('onboarding.abel.sceneFour.breathJobReference'),
        before: t('onboarding.abel.sceneFour.breathJobBefore'),
        highlight: t('onboarding.abel.sceneFour.breathJobHighlight'),
        after: t('onboarding.abel.sceneFour.breathJobAfter'),
      },
      {
        reference: t('onboarding.abel.sceneFour.breathPsalmThirtyNineReference'),
        before: t('onboarding.abel.sceneFour.breathPsalmThirtyNineBefore'),
        highlight: t('onboarding.abel.sceneFour.breathPsalmThirtyNineHighlight'),
        after: t('onboarding.abel.sceneFour.breathPsalmThirtyNineAfter'),
      },
      {
        reference: t('onboarding.abel.sceneFour.breathPsalmOneFortyFourReference'),
        before: t('onboarding.abel.sceneFour.breathPsalmOneFortyFourBefore'),
        highlight: t('onboarding.abel.sceneFour.breathPsalmOneFortyFourHighlight'),
        after: t('onboarding.abel.sceneFour.breathPsalmOneFortyFourAfter'),
      },
    ]
  }

  return [
    {
      reference: t('onboarding.abel.sceneFour.proverbsReference'),
      before: t('onboarding.abel.sceneFour.proverbsBefore'),
      highlight: t('onboarding.abel.sceneFour.proverbsHighlight'),
    },
    {
      reference: t('onboarding.abel.sceneFour.jobReference'),
      before: t('onboarding.abel.sceneFour.jobBefore'),
      highlight: t('onboarding.abel.sceneFour.jobHighlight'),
      after: t('onboarding.abel.sceneFour.jobAfter'),
    },
    {
      reference: t('onboarding.abel.sceneFour.ecclesiastesReference'),
      before: t('onboarding.abel.sceneFour.ecclesiastesHighlightOne'),
      highlight: t('onboarding.abel.sceneFour.ecclesiastesHighlightTwo'),
      after: t('onboarding.abel.sceneFour.ecclesiastesAfter'),
    },
  ]
}

type StrongLemmaCardProps = {
  metrics: OnboardingStageMetrics
  t: TFunction
}

const OccurrenceCounter = ({ metrics, t }: StrongLemmaCardProps) => {
  const stylingTheme = useStylingTheme()

  const s = metrics.s

  return (
    <HStack
      className="overflow-hidden border-continuous absolute bg-light-primary justify-center items-center"
      style={{
        width: s(110),
        height: s(21),
        bottom: s(-11),
        left: s(47),
        borderRadius: s(11),
        gap: s(3),
      }}
    >
      <Text
        className="font-bold"
        style={{
          fontSize: s(9) || 16,
          lineHeight: s(16),
          fontFamily: resolveFontFamily(stylingTheme.fontFamily.title),
        }}
      >
        {t('onboarding.abel.sceneFour.occurrenceCount')}
      </Text>
      <Text className="text-tertiary font-bold" style={{ fontSize: s(7) || 16 }}>
        {t('onboarding.abel.sceneFour.usageCount')}
      </Text>
    </HStack>
  )
}

const StrongLemmaCard = ({ metrics, t }: StrongLemmaCardProps) => {
  const stylingTheme = useStylingTheme()

  const s = metrics.s

  return (
    <VStack
      className="border-continuous overflow-visible flex-[1] bg-reverse justify-center items-center"
      style={[
        { paddingHorizontal: s(14), paddingVertical: s(10), borderRadius: s(26), gap: s(2) },
        { boxShadow: '0 5px 16px rgba(59,92,204,0.13)' },
      ]}
    >
      <Text
        className="text-primary font-bold"
        style={[{ fontSize: s(9) || 16 }, { letterSpacing: s(1.1) }]}
      >
        {t('onboarding.abel.sceneFour.hebrew')}
      </Text>
      <Text
        className="font-bold text-center"
        style={[{ fontSize: s(30) || 16, lineHeight: s(36) }, { writingDirection: 'rtl' }]}
      >
        הֶבֶל
      </Text>
      <Text
        className="text-primary"
        style={[
          {
            fontSize: s(21) || 16,
            lineHeight: s(24),
            fontFamily: resolveFontFamily(stylingTheme.fontFamily.title),
          },
          { fontFamily: 'Literata Book', fontStyle: 'italic' },
        ]}
      >
        {t('onboarding.abel.sceneThree.commonTransliteration')}
      </Text>
      <Text className="text-tertiary text-center" style={{ fontSize: s(9.5) || 16 }}>
        {t('onboarding.abel.sceneFour.lemmaDetails')}
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
}: OccurrenceFilterProps) => {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={() => onPress(id)}
      hitSlop={metrics.s(4)}
      style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
    >
      <AnimatedBox
        className={twMerge(
          'overflow-hidden border-continuous',
          twMerge(active ? 'bg-light-primary' : 'bg-reverse', 'items-center justify-center')
        )}
        style={[
          {
            paddingHorizontal: metrics.s(10),
            paddingVertical: metrics.s(6),
            borderRadius: metrics.s(14),
          },
          {
            transitionProperty: 'backgroundColor',
            transitionDuration: 280,
            transitionDelay: 800,
            transitionTimingFunction: 'ease-in-out',
          },
        ]}
      >
        <Text
          className={twMerge(active ? 'text-primary' : 'text-tertiary', 'font-bold')}
          style={{ fontSize: metrics.s(8.5) || 16 }}
        >
          {label}
        </Text>
      </AnimatedBox>
    </Pressable>
  )
}

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
    className="overflow-hidden border-continuous flex-[1] items-center justify-center bg-reverse px-[3px] rounded-[30px] self-center"
    style={{
      gap: metrics.s(6),
      shadowColor: 'rgb(89,131,240)',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 7,
      elevation: 1,
      overflow: 'visible',
    }}
  >
    <OccurrenceFilter
      active={activeFilter === 'vanity'}
      id="vanity"
      label={t('onboarding.abel.sceneFour.filterVanity')}
      metrics={metrics}
      onPress={onFilterChange}
    />
    <OccurrenceFilter
      active={activeFilter === 'idol'}
      id="idol"
      label={t('onboarding.abel.sceneFour.filterIdol')}
      metrics={metrics}
      onPress={onFilterChange}
    />
    <OccurrenceFilter
      active={activeFilter === 'breath'}
      id="breath"
      label={t('onboarding.abel.sceneFour.filterBreath')}
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
      <Text
        className="text-primary font-bold"
        style={[{ fontSize: s(9) || 16 }, { letterSpacing: s(1.2) }]}
      >
        {content.reference}
      </Text>
      <Text
        style={{
          marginTop: s(8),
          fontSize: s(featured ? 12.3 : 10.6) || 16,
          lineHeight: s(featured ? 15.5 : 13.5),
        }}
      >
        {content.children}
      </Text>
    </>
  )

  return (
    <Box
      className={twMerge(
        'overflow-hidden border-continuous',
        twMerge(
          featured ? 'border-primary' : '',
          'overflow-hidden border-continuous flex-[1] bg-reverse'
        )
      )}
      style={[
        { borderRadius: s(featured ? 22 : 18), borderWidth: featured ? s(1.5) : 0 },
        { boxShadow: '0 7px 18px rgba(59,92,204,0.11)', overflow: 'hidden' },
      ]}
    >
      <Box
        className="overflow-hidden border-continuous absolute left-[0px] top-[0px] right-[0px] bottom-[0px]"
        style={{ overflow: 'hidden' }}
      >
        {previousContent ? (
          <AnimatedBox
            className="overflow-hidden border-continuous absolute"
            pointerEvents="none"
            style={[
              {
                top: s(featured ? 12 : 10),
                bottom: s(featured ? 12 : 10),
                left: s(featured ? 14 : 10),
                right: s(featured ? 14 : 10),
              },
              previousContentStyle,
            ]}
          >
            {renderContent(previousContent)}
          </AnimatedBox>
        ) : null}
        <AnimatedBox
          className="overflow-hidden border-continuous absolute"
          pointerEvents="none"
          style={[
            {
              top: s(featured ? 12 : 10),
              bottom: s(featured ? 12 : 10),
              left: s(featured ? 14 : 10),
              right: s(featured ? 14 : 10),
            },
            currentContentStyle,
          ]}
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
  onAddNotePress: () => void
  onFilterChange: (filter: OccurrenceFilterId) => void
  reduceMotion: boolean
  t: TFunction
}

export const createSceneFourOccurrences = ({
  activeFilter,
  filterDirection,
  highlightColor,
  metrics,
  onAddNotePress,
  onFilterChange,
  reduceMotion,
  t,
}: CreateSceneFourOccurrencesProps) => {
  const verses = getOccurrenceVerses(activeFilter, t)
  const renderVerse = (verse: OccurrenceVerse, fontSize: number) => (
    <>
      {verse.before}
      <Text className="text-primary font-bold" style={{ fontSize: metrics.s(fontSize) || 16 }}>
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
              <Text className="text-primary font-bold" style={{ fontSize: metrics.s(12.3) || 16 }}>
                {t('onboarding.abel.sceneFour.ecclesiastesHighlightOne')}
              </Text>
              {t('onboarding.abel.sceneFour.ecclesiastesMiddle')}
              <Text className="text-primary font-bold" style={{ fontSize: metrics.s(12.3) || 16 }}>
                {verses[2].highlight}
              </Text>
              {verses[2].after}
            </>
          ) : (
            renderVerse(verses[2], 12.3)
          )}
        </OccurrenceVerseCard>
      </Scene.Node>

      <Scene.Node
        id="note-create"
        layout="resize"
        frame={{ x: 246, y: 405, width: 42, height: 42, zIndex: 8 }}
        onPress={onAddNotePress}
        enterFrom={{ scale: 0.5 }}
        exitTo={{ scale: 1.5 }}
        enterDelay={1100}
        pressScale={0.96}
        accessibilityLabel={t('onboarding.abel.sceneFour.addNote')}
      >
        <SceneActionButton icon="file-plus" metrics={metrics} />
      </Scene.Node>

      <SceneDecorativePluses metrics={metrics} reduceMotion={reduceMotion} scene="four" />
    </Scene>
  )
}
