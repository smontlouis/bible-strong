import { useTheme } from '@emotion/react'
import { Feather } from '@expo/vector-icons'
import type { TFunction } from 'i18next'
import { FadeInUp } from 'react-native-reanimated'

import CommentIcon from '~common/CommentIcon'
import DictionnaryIcon from '~common/DictionnaryIcon'
import LexiqueIcon from '~common/LexiqueIcon'
import NaveIcon from '~common/NaveIcon'
import RefIcon from '~common/RefIcon'
import Box, { AnimatedBox, HStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import type { OnboardingStageMetrics } from '../onboarding/OnboardingStage'
import SceneBackgroundShape from '../onboarding/SceneBackgroundShape'
import { Scene } from '../onboarding/SceneGraph'
import VerseCard, { type HighlightColor } from '../onboarding/VerseCard'

const SCENE_TWO_ENTRANCE_TIMING = {
  start: 200,
  stagger: 80,
} as const

const entranceDelay = (index: number) =>
  SCENE_TWO_ENTRANCE_TIMING.start + SCENE_TWO_ENTRANCE_TIMING.stagger * index

const SCENE_TWO_ENTRANCE_DELAYS = {
  dictionary: entranceDelay(0),
  references: entranceDelay(1),
  lexique: entranceDelay(2),
  comments: entranceDelay(3),
  themes: entranceDelay(4),
  translations: entranceDelay(5),
} as const

type SceneTwoNodeCardProps = {
  label: string
  icon: SceneTwoNodeIcon
  metrics: OnboardingStageMetrics
  active?: boolean
  iconSize?: number
  fontSize?: number
}

type SceneTwoNodeIcon =
  | 'dictionary'
  | 'references'
  | 'lexique'
  | 'comments'
  | 'themes'
  | 'translations'

const SceneTwoFeatureIcon = ({
  icon,
  size,
  color,
}: {
  icon: SceneTwoNodeIcon
  size: number
  color: string
}) => {
  switch (icon) {
    case 'dictionary':
      return <DictionnaryIcon size={size} color={color} />
    case 'references':
      return <RefIcon size={size} color={color} />
    case 'lexique':
      return <LexiqueIcon size={size} color={color} />
    case 'comments':
      return <CommentIcon size={size} color={color} />
    case 'themes':
      return <NaveIcon size={size} color={color} />
    case 'translations':
      return <Feather name="globe" size={size} color={color} />
  }
}

export const SceneTwoNodeCard = ({
  label,
  icon,
  metrics,
  active = false,
  iconSize,
  fontSize,
}: SceneTwoNodeCardProps) => {
  const theme = useTheme()
  const s = metrics.s
  const resolvedIconSize = iconSize ?? (active ? 26 : 14)
  const resolvedFontSize = fontSize ?? (active ? 16 : 8)
  const iconColor = {
    dictionary: theme.colors.secondary,
    references: theme.colors.quart,
    lexique: theme.colors.primary,
    comments: 'rgb(38,166,154)',
    themes: theme.colors.quint,
    translations: theme.colors.primary,
  }[icon]
  const shadowOpacity = active ? 0.32 : 0.1
  const shadowColor = iconColor.replace('rgb(', 'rgba(').replace(')', `,${shadowOpacity})`)

  return (
    <Box
      flex={1}
      bg="reverse"
      borderRadius={active ? s(20) : s(12)}
      borderWidth={active ? s(2) : 0}
      borderColor={active ? 'primary' : undefined}
      overflow="visible"
      style={{
        boxShadow: `0 ${s(3)}px ${s(active ? 10 : 7)}px 0 ${shadowColor}`,
      }}
      center
    >
      <HStack alignItems="center" gap={s(active ? 9 : 6)} px={s(active ? 16 : 10)}>
        <SceneTwoFeatureIcon icon={icon} size={s(resolvedIconSize)} color={iconColor} />
        <Text title={active} bold={!active} fontSize={s(resolvedFontSize)} numberOfLines={1}>
          {label}
        </Text>
      </HStack>
    </Box>
  )
}

type SceneTwoBackgroundProps = {
  metrics: OnboardingStageMetrics
  reduceMotion: boolean
}

export const SceneTwoBackground = ({ metrics, reduceMotion }: SceneTwoBackgroundProps) => {
  const s = metrics.s

  return (
    <Box flex width="100%" overflow="visible">
      <AnimatedBox
        position="absolute"
        left={s(30)}
        top={s(40)}
        entering={reduceMotion ? undefined : FadeInUp.springify().delay(260)}
      >
        <Text color="secondary" fontSize={s(18)} bold>
          +
        </Text>
      </AnimatedBox>
      <AnimatedBox
        position="absolute"
        left={s(308)}
        top={s(118)}
        entering={reduceMotion ? undefined : FadeInUp.springify().delay(420)}
      >
        <Text color="primary" fontSize={s(13)} bold>
          +
        </Text>
      </AnimatedBox>
      <AnimatedBox
        position="absolute"
        left={s(194)}
        top={s(423)}
        entering={reduceMotion ? undefined : FadeInUp.springify().delay(500)}
      >
        <Text color="primary" fontSize={s(14)} bold>
          +
        </Text>
      </AnimatedBox>
    </Box>
  )
}

type CreateSceneTwoLexiqueProps = SceneTwoBackgroundProps & {
  highlightColor: HighlightColor
  onLexiquePress: () => void
  t: TFunction
}

export const createSceneTwoLexique = ({
  highlightColor,
  metrics,
  reduceMotion,
  t,
  onLexiquePress,
}: CreateSceneTwoLexiqueProps) => (
  <Scene id="scene-two">
    <SceneTwoBackground metrics={metrics} reduceMotion={reduceMotion} />
    <Scene.Node
      id="scene-background"
      layout="resize"
      frame={{ x: 10, y: 24, width: 330, height: 430, opacity: 0.62, zIndex: 0 }}
      pointerEvents="none"
    >
      <SceneBackgroundShape borderRadius={metrics.s(28)} reduceMotion={reduceMotion} />
    </Scene.Node>
    <Scene.Node
      id="verse-card"
      layout="scale"
      frame={{
        x: -90,
        y: 221,
        width: 382,
        height: 294,
        scale: 0.5,
        rotation: -5,
        zIndex: 5,
        anchors: { highlightedWord: { x: 0.43, y: 0.52 } },
      }}
      draggable
      dragFriction={0.1}
    >
      <VerseCard reduceMotion={reduceMotion} highlightColor={highlightColor} metrics={metrics} />
    </Scene.Node>

    <Scene.Node
      id="dictionary"
      frame={{ x: 16, y: 62, width: 98, height: 47 }}
      enterDelay={SCENE_TWO_ENTRANCE_DELAYS.dictionary}
      enterFrom={{ x: 4, y: 30 }}
      exitTo={{ x: 4, y: 30 }}
      draggable
      dragFriction={0.1}
    >
      <SceneTwoNodeCard
        label={t('playground.sceneTwo.dictionary')}
        icon="dictionary"
        metrics={metrics}
      />
    </Scene.Node>
    <Scene.Node
      id="references"
      frame={{ x: 226, y: 46, width: 100, height: 47 }}
      enterDelay={SCENE_TWO_ENTRANCE_DELAYS.references}
      enterFrom={{ x: -15, y: 26 }}
      exitTo={{ x: -15, y: 26 }}
      draggable
      dragFriction={0.1}
    >
      <SceneTwoNodeCard
        label={t('playground.sceneTwo.references')}
        icon="references"
        metrics={metrics}
      />
    </Scene.Node>
    <Scene.Node
      id="lexique"
      frame={{ x: 118, y: 131, width: 158, height: 72 }}
      enterDelay={SCENE_TWO_ENTRANCE_DELAYS.lexique}
      enterFrom={{ x: -13, y: 27 }}
      exitTo={{ x: -13, y: 27 }}
      draggable
      dragFriction={0.1}
      onPress={onLexiquePress}
      pressScale={0.96}
      accessibilityLabel={t('playground.sceneTwo.lexique')}
    >
      <SceneTwoNodeCard
        label={t('playground.sceneTwo.lexique')}
        icon="lexique"
        metrics={metrics}
        active
      />
    </Scene.Node>
    <Scene.Node
      id="comments"
      frame={{ x: 212, y: 256, width: 114, height: 47 }}
      enterDelay={SCENE_TWO_ENTRANCE_DELAYS.comments}
      enterFrom={{ x: -26, y: 14 }}
      exitTo={{ x: -26, y: 14 }}
      draggable
      dragFriction={0.1}
    >
      <SceneTwoNodeCard
        label={t('playground.sceneTwo.comments')}
        icon="comments"
        metrics={metrics}
      />
    </Scene.Node>
    <Scene.Node
      id="themes"
      frame={{ x: 254, y: 316, width: 100, height: 47 }}
      enterDelay={SCENE_TWO_ENTRANCE_DELAYS.themes}
      enterFrom={{ x: -30, y: 4 }}
      exitTo={{ x: -30, y: 4 }}
      draggable
      dragFriction={0.1}
    >
      <SceneTwoNodeCard label={t('playground.sceneTwo.themes')} icon="themes" metrics={metrics} />
    </Scene.Node>
    <Scene.Node
      id="translations"
      frame={{ x: 213, y: 380, width: 126, height: 47 }}
      enterDelay={SCENE_TWO_ENTRANCE_DELAYS.translations}
      enterFrom={{ x: -29, y: -6 }}
      exitTo={{ x: -29, y: -6 }}
      draggable
      dragFriction={0.1}
    >
      <SceneTwoNodeCard
        label={t('playground.sceneTwo.translations')}
        icon="translations"
        metrics={metrics}
      />
    </Scene.Node>

    <Scene.Connection
      from={{ node: 'verse-card', anchor: 'center' }}
      to={{ node: 'dictionary', anchor: 'center' }}
      curve={{ type: 'quadratic', bend: 0.08 }}
      enterDelay={SCENE_TWO_ENTRANCE_DELAYS.dictionary}
    />
    <Scene.Connection
      from={{ node: 'verse-card', anchor: 'center' }}
      to={{ node: 'references', anchor: 'center' }}
      curve={{ type: 'quadratic', bend: 0.08 }}
      enterDelay={SCENE_TWO_ENTRANCE_DELAYS.references}
    />
    <Scene.Connection
      from={{ node: 'verse-card', anchor: 'center' }}
      to={{ node: 'lexique', anchor: 'center' }}
      curve={{ type: 'quadratic', bend: 0.08 }}
      enterDelay={SCENE_TWO_ENTRANCE_DELAYS.lexique}
      opacity={0.8}
      width={2}
    />
    <Scene.Connection
      from={{ node: 'verse-card', anchor: 'center' }}
      to={{ node: 'comments', anchor: 'center' }}
      curve={{ type: 'quadratic', bend: 0.08 }}
      enterDelay={SCENE_TWO_ENTRANCE_DELAYS.comments}
    />
    <Scene.Connection
      from={{ node: 'verse-card', anchor: 'center' }}
      to={{ node: 'themes', anchor: 'center' }}
      curve={{ type: 'quadratic', bend: 0.08 }}
      enterDelay={SCENE_TWO_ENTRANCE_DELAYS.themes}
    />
    <Scene.Connection
      from={{ node: 'verse-card', anchor: 'center' }}
      to={{ node: 'translations', anchor: 'center' }}
      curve={{ type: 'quadratic', bend: 0.08 }}
      enterDelay={SCENE_TWO_ENTRANCE_DELAYS.translations}
    />
  </Scene>
)
