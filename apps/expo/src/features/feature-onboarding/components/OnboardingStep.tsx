import { AnimatedBox, fadeSlideLeftIn, fadeSlideRightOut } from '~common/ui/Box'
import SheetWell from '~common/ui/SheetWell'
import Text from '~common/ui/Text'
import GestureDemo from '../demos/GestureDemo'
import type { OnboardingStepConfig } from '../types'

interface OnboardingStepProps {
  step: OnboardingStepConfig
}

const OnboardingStep = ({ step }: OnboardingStepProps) => {
  return (
    <AnimatedBox
      className={step.demo ? 'px-[20px] pt-[48px] pb-[0px]' : 'px-[24px] pt-[20px] pb-[0px]'}
      entering={fadeSlideLeftIn}
      exiting={fadeSlideRightOut}
      key={step.title}
    >
      {step.demo && (
        <SheetWell className="mb-[18px]">
          <GestureDemo id={step.demo} />
        </SheetWell>
      )}
      <Text
        className={
          step.demo ? 'font-bold text-[20px] mb-[12px] mx-[4px]' : 'font-bold text-[20px] mb-[12px]'
        }
      >
        {step.title}
      </Text>
      <Text
        className={
          step.demo
            ? 'text-[15px] text-grey leading-[22px] mx-[4px]'
            : 'text-[15px] text-grey leading-[22px]'
        }
      >
        {step.description}
      </Text>
    </AnimatedBox>
  )
}

export default OnboardingStep
