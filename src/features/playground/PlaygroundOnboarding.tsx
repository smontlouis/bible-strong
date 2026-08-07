import { useTheme } from '@emotion/react'
import { Feather } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Pressable, useWindowDimensions, View } from 'react-native'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import Box, { AnimatedBox, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { OnboardingStage } from './onboarding/OnboardingStage'
import { Scene, SceneGraph } from './onboarding/SceneGraph'
import { ONBOARDING_SCENE_COUNT, ONBOARDING_SCENES } from './onboarding/sceneRegistry'
import VerseCard, { type HighlightColor } from './onboarding/VerseCard'
import {
  SceneOneVerseHighlightBackground,
  SceneOneVerseHighlightControls,
} from './scenes/SceneOneVerseHighlight'
import { SceneTwoBackground, SceneTwoNodeCard } from './scenes/SceneTwoLexique'

type PlaygroundOnboardingProps = {
  onComplete: () => void
}

const PlaygroundOnboarding = ({ onComplete }: PlaygroundOnboardingProps) => {
  const theme = useTheme()
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const reduceMotion = useReducedMotion()
  const [sceneIndex, setSceneIndex] = useState(0)
  const [isFinishing, setIsFinishing] = useState(false)
  const [activeColor, setActiveColor] = useState<HighlightColor>('color2')
  const [sceneViewportHeight, setSceneViewportHeight] = useState<number>()
  const currentScene = ONBOARDING_SCENES[sceneIndex]
  const progress = isFinishing ? 1 : (sceneIndex + 1) / ONBOARDING_SCENE_COUNT
  const progressValue = useSharedValue(progress)
  // The storyboard is authored at 390 pt wide with a 350 pt content column.
  // Keep that column centered, but let it shrink on narrower phones.
  const contentWidth = Math.min(350, Math.max(width - 40, 1))
  const progressWidth = Math.min(145, contentWidth * 0.42)

  useEffect(() => {
    progressValue.set(withTiming(progress, { duration: reduceMotion ? 0 : 520 }))
  }, [progress, progressValue, reduceMotion])

  useEffect(() => {
    if (!isFinishing) return
    const timeout = setTimeout(onComplete, reduceMotion ? 0 : 620)
    return () => clearTimeout(timeout)
  }, [isFinishing, onComplete, reduceMotion])

  const progressStyle = useAnimatedStyle(() => ({
    width: progressValue.get() * progressWidth,
  }))

  const finish = () => {
    if (!isFinishing) setIsFinishing(true)
  }

  const advance = () => {
    if (sceneIndex < ONBOARDING_SCENES.length - 1) {
      setSceneIndex(value => value + 1)
      return
    }

    finish()
  }

  return (
    <Box flex bg="lightGrey" pt={insets.top}>
      <Box width={contentWidth} height={28} mt={19} alignSelf="center" position="relative">
        <Box position="absolute" left={0} right={0} top={10} alignItems="center">
          <Box
            width={progressWidth}
            height={8}
            borderRadius={4}
            bg="lightPrimary"
            overflow="visible"
          >
            <Animated.View
              style={[
                { height: 8, borderRadius: 4, backgroundColor: theme.colors.primary },
                progressStyle,
              ]}
            />
          </Box>
        </Box>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('playground.onboarding.skip')}
          onPress={finish}
          hitSlop={10}
          style={({ pressed }) => ({
            position: 'absolute',
            right: 0,
            top: 0,
            opacity: pressed ? 0.62 : 1,
          })}
        >
          <Text color="primary" fontSize={16} bold>
            {t('playground.onboarding.skip')}
          </Text>
        </Pressable>
      </Box>

      <View
        style={{ flex: 1, paddingHorizontal: 12, overflow: 'visible' }}
        onLayout={({ nativeEvent }) => {
          const nextHeight = nativeEvent.layout.height
          setSceneViewportHeight(currentHeight =>
            currentHeight === nextHeight ? currentHeight : nextHeight
          )
        }}
      >
        <AnimatedBox
          key={isFinishing ? 'playground-complete' : 'playground-scenes'}
          flex={1}
          overflow="visible"
          entering={reduceMotion ? undefined : FadeIn.duration(300)}
          exiting={reduceMotion ? undefined : FadeOut.duration(260)}
        >
          {isFinishing ? (
            <VStack flex={1} alignItems="center" justifyContent="center" gap={12}>
              <AnimatedBox
                size={72}
                borderRadius={36}
                bg="lightPrimary"
                center
                entering={reduceMotion ? undefined : FadeInDown.duration(420)}
              >
                <Feather name="check" size={30} color={theme.colors.primary} />
              </AnimatedBox>
              <Text title fontSize={27} textAlign="center">
                {t('playground.onboarding.complete')}
              </Text>
            </VStack>
          ) : (
            <OnboardingStage availableHeight={sceneViewportHeight}>
              {metrics => (
                <SceneGraph
                  activeSceneId={currentScene.id}
                  connectionColor={theme.colors.primary}
                  metrics={metrics}
                  reduceMotion={reduceMotion}
                >
                  <Scene id="scene-one">
                    <SceneOneVerseHighlightBackground
                      metrics={metrics}
                      reduceMotion={reduceMotion}
                    />
                    <Scene.Node
                      id="verse-card"
                      layout="scale"
                      frame={{
                        x: -16,
                        y: 82,
                        width: 382,
                        height: 294,
                        rotation: -1,
                        zIndex: 4,
                        anchors: { highlightedWord: { x: 0.43, y: 0.52 } },
                      }}
                    >
                      <VerseCard
                        reduceMotion={reduceMotion}
                        highlightColor={activeColor}
                        metrics={metrics}
                      />
                    </Scene.Node>
                    <SceneOneVerseHighlightControls
                      metrics={metrics}
                      reduceMotion={reduceMotion}
                      activeColor={activeColor}
                      onColorSelect={setActiveColor}
                    />
                  </Scene>

                  <Scene id="scene-two">
                    <SceneTwoBackground metrics={metrics} reduceMotion={reduceMotion} />
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
                      <VerseCard
                        reduceMotion={reduceMotion}
                        highlightColor={activeColor}
                        metrics={metrics}
                      />
                    </Scene.Node>

                    <Scene.Node id="dictionary" frame={{ x: 16, y: 62, width: 98, height: 47 }}>
                      <SceneTwoNodeCard
                        label={t('playground.sceneTwo.dictionary')}
                        icon="book-open"
                        metrics={metrics}
                      />
                    </Scene.Node>
                    <Scene.Node id="references" frame={{ x: 226, y: 46, width: 100, height: 47 }}>
                      <SceneTwoNodeCard
                        label={t('playground.sceneTwo.references')}
                        icon="git-branch"
                        metrics={metrics}
                      />
                    </Scene.Node>
                    <Scene.Node id="lexique" frame={{ x: 118, y: 131, width: 158, height: 72 }}>
                      <SceneTwoNodeCard
                        label={t('playground.sceneTwo.lexique')}
                        icon="book"
                        metrics={metrics}
                        active
                        onPress={() => undefined}
                      />
                    </Scene.Node>
                    <Scene.Node id="comments" frame={{ x: 212, y: 256, width: 114, height: 47 }}>
                      <SceneTwoNodeCard
                        label={t('playground.sceneTwo.comments')}
                        icon="message-square"
                        metrics={metrics}
                      />
                    </Scene.Node>
                    <Scene.Node id="themes" frame={{ x: 254, y: 316, width: 100, height: 47 }}>
                      <SceneTwoNodeCard
                        label={t('playground.sceneTwo.themes')}
                        icon="tag"
                        metrics={metrics}
                      />
                    </Scene.Node>
                    <Scene.Node
                      id="translations"
                      frame={{ x: 213, y: 380, width: 126, height: 47 }}
                    >
                      <SceneTwoNodeCard
                        label={t('playground.sceneTwo.translations')}
                        icon="globe"
                        metrics={metrics}
                      />
                    </Scene.Node>

                    <Scene.Connection
                      from={{ node: 'verse-card', anchor: 'topLeft' }}
                      to={{ node: 'dictionary', anchor: 'bottom' }}
                    />
                    <Scene.Connection
                      from={{ node: 'verse-card', anchor: 'topRight' }}
                      to={{ node: 'references', anchor: 'bottom' }}
                    />
                    <Scene.Connection
                      from={{ node: 'verse-card', anchor: 'highlightedWord' }}
                      to={{ node: 'lexique', anchor: 'bottom' }}
                      opacity={0.8}
                      width={2}
                    />
                    <Scene.Connection
                      from={{ node: 'verse-card', anchor: 'right' }}
                      to={{ node: 'comments', anchor: 'left' }}
                    />
                    <Scene.Connection
                      from={{ node: 'verse-card', anchor: 'right' }}
                      to={{ node: 'themes', anchor: 'left' }}
                    />
                    <Scene.Connection
                      from={{ node: 'verse-card', anchor: 'bottomRight' }}
                      to={{ node: 'translations', anchor: 'left' }}
                    />
                  </Scene>
                </SceneGraph>
              )}
            </OnboardingStage>
          )}
        </AnimatedBox>
      </View>

      <VStack width={contentWidth} alignSelf="center" pb={Math.max(insets.bottom, 24)} gap={20}>
        <Text
          title
          fontSize={currentScene.id === 'scene-two' ? 25 : 32}
          lineHeight={currentScene.id === 'scene-two' ? 32 : 38}
          textAlign="center"
          style={{ fontFamily: 'Literata Book' }}
        >
          {t(currentScene.promptKey)}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('playground.onboarding.continue')}
          onPress={advance}
          style={({ pressed }) => ({ opacity: pressed ? 0.86 : 1 })}
        >
          <Box
            bg="primary"
            borderRadius={29}
            height={58}
            center
            lightShadow
            style={{ flexDirection: 'row', gap: 12 }}
          >
            <Text color="reverse" fontSize={17} bold>
              {t('playground.onboarding.continue')}
            </Text>
            <Feather name="arrow-right" size={23} color={theme.colors.reverse} />
          </Box>
        </Pressable>
      </VStack>
    </Box>
  )
}

export default PlaygroundOnboarding
