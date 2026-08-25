import { AnimatedBox, fadeSlideLeftIn, fadeSlideRightOut } from '~common/ui/Box'
import Text from '~common/ui/Text'
import type { OnboardingStepConfig } from '../types'

interface OnboardingStepProps {
  step: OnboardingStepConfig
}

const OnboardingStep = ({ step }: OnboardingStepProps) => {
  return (
    <AnimatedBox
      entering={fadeSlideLeftIn}
      exiting={fadeSlideRightOut}
      px={24}
      pt={20}
      pb={0}
      key={step.title}
    >
      <Text bold fontSize={20} mb={12}>
        {step.title}
      </Text>
      <Text fontSize={15} color="grey" lineHeight={22}>
        {step.description}
      </Text>
    </AnimatedBox>
  )
}

export default OnboardingStep
