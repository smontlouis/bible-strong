import { AnimatedBox, fadeSlideLeftIn, fadeSlideRightOut } from '~common/ui/Box'
import Text from '~common/ui/Text'
import type { OnboardingStepConfig } from '../types'
interface OnboardingStepProps {
  step: OnboardingStepConfig
}

const OnboardingStep = ({ step }: OnboardingStepProps) => {
  return (
    <AnimatedBox
      className="px-[24px] pt-[20px] pb-[0px]"
      entering={fadeSlideLeftIn}
      exiting={fadeSlideRightOut}
      key={step.title}
    >
      <Text className="font-bold text-[20px] mb-[12px]">{step.title}</Text>
      <Text className="text-[15px] text-grey leading-[22px]">{step.description}</Text>
    </AnimatedBox>
  )
}

export default OnboardingStep
