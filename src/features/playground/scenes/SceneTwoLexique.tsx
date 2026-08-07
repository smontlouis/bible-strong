import { useTheme } from '@emotion/react'
import { Feather } from '@expo/vector-icons'
import type { TFunction } from 'i18next'
import type { ComponentProps } from 'react'
import { Pressable } from 'react-native'
import { FadeInUp } from 'react-native-reanimated'

import Box, { AnimatedBox, HStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import type { OnboardingStageMetrics } from '../onboarding/OnboardingStage'
import SceneBackgroundShape from '../onboarding/SceneBackgroundShape'
import { Scene } from '../onboarding/SceneGraph'
import VerseCard, { type HighlightColor } from '../onboarding/VerseCard'

type SceneTwoNodeCardProps = {
  label: string
  icon: ComponentProps<typeof Feather>['name']
  metrics: OnboardingStageMetrics
  active?: boolean
  iconSize?: number
  fontSize?: number
  onPress?: () => void
}

export const SceneTwoNodeCard = ({
  label,
  icon,
  metrics,
  active = false,
  iconSize,
  fontSize,
  onPress,
}: SceneTwoNodeCardProps) => {
  const theme = useTheme()
  const s = metrics.s
  const resolvedIconSize = iconSize ?? (active ? 30 : 14)
  const resolvedFontSize = fontSize ?? (active ? 16 : 8)

  const card = (
    <Box
      flex={1}
      bg="reverse"
      borderRadius={active ? s(17) : s(12)}
      borderWidth={active ? s(2) : 0}
      borderColor={active ? 'primary' : undefined}
      lightShadow
      center
    >
      <HStack alignItems="center" gap={s(active ? 5 : 6)} px={s(active ? 16 : 10)}>
        <Feather name={icon} size={s(resolvedIconSize)} color={theme.colors.primary} />
        <Text title={active} bold={!active} fontSize={s(resolvedFontSize)} numberOfLines={1}>
          {label}
        </Text>
      </HStack>
    </Box>
  )

  if (!onPress) return card

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.82 : 1 })}
    >
      {card}
    </Pressable>
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
  t: TFunction
}

export const createSceneTwoLexique = ({
  highlightColor,
  metrics,
  reduceMotion,
  t,
}: CreateSceneTwoLexiqueProps) => (
  <Scene id="scene-two">
    <SceneTwoBackground metrics={metrics} reduceMotion={reduceMotion} />
    <Scene.Node
      id="scene-background"
      layout="resize"
      frame={{ x: 10, y: 24, width: 330, height: 430, opacity: 0.62, zIndex: 0 }}
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
        rotation: -2,
        zIndex: 4,
        anchors: { highlightedWord: { x: 0.43, y: 0.52 } },
      }}
    >
      <VerseCard reduceMotion={reduceMotion} highlightColor={highlightColor} metrics={metrics} />
    </Scene.Node>

    <Scene.Node
      id="dictionary"
      frame={{ x: 16, y: 62, width: 98, height: 47 }}
      enterDelay={660}
      enterFrom={{ x: 4, y: 30 }}
    >
      <SceneTwoNodeCard
        label={t('playground.sceneTwo.dictionary')}
        icon="book-open"
        metrics={metrics}
      />
    </Scene.Node>
    <Scene.Node
      id="references"
      frame={{ x: 226, y: 46, width: 100, height: 47 }}
      enterDelay={740}
      enterFrom={{ x: -15, y: 26 }}
    >
      <SceneTwoNodeCard
        label={t('playground.sceneTwo.references')}
        icon="git-branch"
        metrics={metrics}
      />
    </Scene.Node>
    <Scene.Node
      id="lexique"
      frame={{ x: 118, y: 131, width: 158, height: 72 }}
      enterDelay={1120}
      enterFrom={{ x: -13, y: 27 }}
    >
      <SceneTwoNodeCard
        label={t('playground.sceneTwo.lexique')}
        icon="book"
        metrics={metrics}
        active
        onPress={() => undefined}
      />
    </Scene.Node>
    <Scene.Node
      id="comments"
      frame={{ x: 212, y: 256, width: 114, height: 47 }}
      enterDelay={820}
      enterFrom={{ x: -26, y: 14 }}
    >
      <SceneTwoNodeCard
        label={t('playground.sceneTwo.comments')}
        icon="message-square"
        metrics={metrics}
      />
    </Scene.Node>
    <Scene.Node
      id="themes"
      frame={{ x: 254, y: 316, width: 100, height: 47 }}
      enterDelay={900}
      enterFrom={{ x: -30, y: 4 }}
    >
      <SceneTwoNodeCard label={t('playground.sceneTwo.themes')} icon="tag" metrics={metrics} />
    </Scene.Node>
    <Scene.Node
      id="translations"
      frame={{ x: 213, y: 380, width: 126, height: 47 }}
      enterDelay={980}
      enterFrom={{ x: -29, y: -6 }}
    >
      <SceneTwoNodeCard
        label={t('playground.sceneTwo.translations')}
        icon="globe"
        metrics={metrics}
      />
    </Scene.Node>

    <Scene.Connection
      from={{ node: 'verse-card', anchor: 'center' }}
      to={{ node: 'dictionary', anchor: 'center' }}
      curve={{ type: 'quadratic', bend: 0.08 }}
      enterDelay={660}
    />
    <Scene.Connection
      from={{ node: 'verse-card', anchor: 'center' }}
      to={{ node: 'references', anchor: 'center' }}
      curve={{ type: 'quadratic', bend: 0.08 }}
      enterDelay={740}
    />
    <Scene.Connection
      from={{ node: 'verse-card', anchor: 'center' }}
      to={{ node: 'lexique', anchor: 'center' }}
      curve={{ type: 'quadratic', bend: 0.08 }}
      enterDelay={1120}
      opacity={0.8}
      width={2}
    />
    <Scene.Connection
      from={{ node: 'verse-card', anchor: 'center' }}
      to={{ node: 'comments', anchor: 'center' }}
      curve={{ type: 'quadratic', bend: 0.08 }}
      enterDelay={820}
    />
    <Scene.Connection
      from={{ node: 'verse-card', anchor: 'center' }}
      to={{ node: 'themes', anchor: 'center' }}
      curve={{ type: 'quadratic', bend: 0.08 }}
      enterDelay={900}
    />
    <Scene.Connection
      from={{ node: 'verse-card', anchor: 'center' }}
      to={{ node: 'translations', anchor: 'center' }}
      curve={{ type: 'quadratic', bend: 0.08 }}
      enterDelay={980}
    />
  </Scene>
)
