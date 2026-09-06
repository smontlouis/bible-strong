import { useTranslation } from 'react-i18next'
import { LinearTransition } from 'react-native-reanimated'
import { AnimatedBox, AnimatedTouchableBox, FadingText } from '~common/ui/Box'
import Text from '~common/ui/Text'
import PaginationDots from './PaginationDots'
type Props = {
  currentStep: number
  totalSteps: number
  onBack: () => void
  onNext: () => void
}

const OnboardingFooter = ({ currentStep, totalSteps, onBack, onNext }: Props) => {
  const { t } = useTranslation()

  const isFirstStep = currentStep === 0
  const isLastStep = currentStep === totalSteps - 1

  return (
    <AnimatedBox
      className="overflow-hidden border-continuous flex-row items-center justify-between px-[18px] py-[16px] mt-auto"
      layout={LinearTransition}
    >
      <AnimatedTouchableBox
        className="overflow-hidden border-continuous py-[10px] px-[20px] rounded-[20px] border-[1px] border-border"
        onPress={onBack}
        disabled={isFirstStep}
        style={[
          { opacity: isFirstStep ? 0.6 : 1 },
          [
            { opacity: isFirstStep ? 0.6 : 1 },
            {
              transitionProperty: 'opacity',
              transitionDuration: 200,
              opacity: isFirstStep ? 0 : 1,
            },
          ],
        ]}
        layout={LinearTransition}
      >
        <Text className="text-[14px] text-grey">{t('onboarding.back')}</Text>
      </AnimatedTouchableBox>

      <PaginationDots currentStep={currentStep} totalSteps={totalSteps} />

      <AnimatedTouchableBox
        className="overflow-hidden border-continuous py-[10px] px-[20px] rounded-[20px] bg-primary"
        onPress={onNext}
        layout={LinearTransition}
      >
        <FadingText className="overflow-hidden border-continuous text-[14px] text-reverse font-bold">
          {isLastStep ? t('onboarding.start') : t('onboarding.next')}
        </FadingText>
      </AnimatedTouchableBox>
    </AnimatedBox>
  )
}

export default OnboardingFooter
