import { useTheme } from '@emotion/react'
import { FadeInUp } from 'react-native-reanimated'

import Box, { AnimatedBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import type { OnboardingStageMetrics } from './OnboardingStage'

export type DecorativePlusScene = 'one' | 'two' | 'three' | 'four' | 'five' | 'six' | 'seven'

type DecorativePlusTone = 'blue' | 'yellow' | 'quart'

type DecorativePlus = {
  x: number
  y: number
  size: number
  tone: DecorativePlusTone
  delay: number
}

const SCENE_DECORATIVE_PLUSES: Record<DecorativePlusScene, readonly DecorativePlus[]> = {
  one: [
    { x: 302, y: 38, size: 19, tone: 'yellow', delay: 340 },
    { x: 24, y: 38, size: 11, tone: 'quart', delay: 390 },
    { x: 8, y: 342, size: 16, tone: 'blue', delay: 430 },
    { x: 326, y: 390, size: 11, tone: 'yellow', delay: 510 },
  ],
  two: [
    { x: 30, y: 40, size: 18, tone: 'yellow', delay: 260 },
    { x: 308, y: 118, size: 13, tone: 'blue', delay: 420 },
    { x: 329, y: 222, size: 10, tone: 'quart', delay: 460 },
    { x: 194, y: 423, size: 14, tone: 'blue', delay: 500 },
  ],
  three: [
    { x: 22, y: 56, size: 11, tone: 'quart', delay: 260 },
    { x: 310, y: 30, size: 18, tone: 'yellow', delay: 300 },
    { x: 18, y: 400, size: 14, tone: 'blue', delay: 420 },
    { x: 327, y: 407, size: 10, tone: 'yellow', delay: 480 },
  ],
  four: [
    { x: 326, y: 42, size: 11, tone: 'yellow', delay: 420 },
    { x: 12, y: 126, size: 10, tone: 'quart', delay: 470 },
    { x: 14, y: 205, size: 18, tone: 'blue', delay: 520 },
    { x: 324, y: 214, size: 14, tone: 'blue', delay: 640 },
  ],
  five: [
    { x: 18, y: 32, size: 11, tone: 'yellow', delay: 400 },
    { x: 326, y: 178, size: 10, tone: 'quart', delay: 460 },
    { x: 16, y: 306, size: 18, tone: 'blue', delay: 520 },
    { x: 322, y: 334, size: 14, tone: 'blue', delay: 640 },
  ],
  six: [
    { x: 12, y: 44, size: 11, tone: 'quart', delay: 260 },
    { x: 326, y: 48, size: 17, tone: 'yellow', delay: 340 },
    { x: 14, y: 414, size: 15, tone: 'blue', delay: 520 },
    { x: 328, y: 420, size: 10, tone: 'yellow', delay: 600 },
  ],
  seven: [
    { x: 12, y: 34, size: 11, tone: 'yellow', delay: 420 },
    { x: 329, y: 38, size: 15, tone: 'blue', delay: 500 },
    { x: 10, y: 422, size: 16, tone: 'quart', delay: 680 },
    { x: 330, y: 418, size: 10, tone: 'yellow', delay: 760 },
  ],
}

type SceneDecorativePlusesProps = {
  metrics: OnboardingStageMetrics
  reduceMotion: boolean
  scene: DecorativePlusScene
}

const SceneDecorativePluses = ({ metrics, reduceMotion, scene }: SceneDecorativePlusesProps) => {
  const theme = useTheme()
  const colors: Record<DecorativePlusTone, string> = {
    blue: theme.colors.primary,
    yellow: theme.colors.secondary,
    quart: theme.colors.quart,
  }

  return (
    <Box absoluteFill pointerEvents="none" overflow="visible">
      {SCENE_DECORATIVE_PLUSES[scene].map((plus, index) => (
        <AnimatedBox
          key={`${scene}-${index}`}
          position="absolute"
          left={metrics.s(plus.x)}
          top={metrics.s(plus.y)}
          entering={reduceMotion ? undefined : FadeInUp.springify().delay(plus.delay)}
        >
          <Text
            bold
            fontSize={metrics.s(plus.size)}
            lineHeight={metrics.s(plus.size)}
            style={{ color: colors[plus.tone] }}
          >
            +
          </Text>
        </AnimatedBox>
      ))}
    </Box>
  )
}

export default SceneDecorativePluses
