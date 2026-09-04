import { useTheme } from '@emotion/react'
import Animated, { LinearTransition } from 'react-native-reanimated'
import { AnimatedBox } from '~common/ui/Box'

interface PaginationDotsProps {
  currentStep: number
  totalSteps: number
}

const PaginationDots = ({ currentStep, totalSteps }: PaginationDotsProps) => {
  const theme = useTheme()

  return (
    <AnimatedBox row center style={{ gap: 8 }} layout={LinearTransition}>
      {Array.from({ length: totalSteps }).map((_, index) => {
        const isActive = index === currentStep
        return (
          <Animated.View
            key={index}
            style={{
              width: isActive ? 14 : 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: isActive ? theme.colors.primary : theme.colors.border,
              transitionProperty: ['backgroundColor', 'width'],
              transitionDuration: 600,
            }}
          />
        )
      })}
    </AnimatedBox>
  )
}

export default PaginationDots
