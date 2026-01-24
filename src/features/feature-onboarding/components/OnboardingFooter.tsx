import { useTheme } from '@emotion/react'
import { useAtomValue } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { LinearTransition } from 'react-native-reanimated'
import { AnimatedBox, AnimatedTouchableBox, FadingText } from '~common/ui/Box'
import Text from '~common/ui/Text'
import {
  onboardingActionsAtom,
  onboardingCurrentStepAtom,
  onboardingTotalStepsAtom,
} from '../atoms'
import PaginationDots from './PaginationDots'

const OnboardingFooter = () => {
  const { t } = useTranslation()
  const theme = useTheme()

  const currentStep = useAtomValue(onboardingCurrentStepAtom)
  const totalSteps = useAtomValue(onboardingTotalStepsAtom)
  const { onBack, onNext } = useAtomValue(onboardingActionsAtom)

  const isFirstStep = currentStep === 0
  const isLastStep = currentStep === totalSteps - 1

  return (
    <AnimatedBox
      row
      alignItems="center"
      justifyContent="space-between"
      px={18}
      py={16}
      bg="reverse"
      mt="auto"
      layout={LinearTransition}
    >
      <AnimatedTouchableBox
        onPress={onBack}
        disabled={isFirstStep}
        py={10}
        px={20}
        borderRadius={20}
        borderWidth={1}
        borderColor={theme.colors.border}
        style={{
          transitionProperty: 'opacity',
          transitionDuration: 200,
          opacity: isFirstStep ? 0 : 1,
        }}
        layout={LinearTransition}
      >
        <Text fontSize={14} color="grey">
          {t('onboarding.back')}
        </Text>
      </AnimatedTouchableBox>

      <PaginationDots currentStep={currentStep} totalSteps={totalSteps} />

      <AnimatedTouchableBox
        onPress={onNext}
        py={10}
        px={20}
        borderRadius={20}
        bg="primary"
        layout={LinearTransition}
      >
        <FadingText fontSize={14} color="reverse" bold>
          {isLastStep ? t('onboarding.start') : t('onboarding.next')}
        </FadingText>
      </AnimatedTouchableBox>
    </AnimatedBox>
  )
}

export default OnboardingFooter
