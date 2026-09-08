import { useAtom, useSetAtom } from 'jotai/react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { SheetView } from '~common/sheet'
import Sheet from '~common/ModalSheet'
import { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { useSheet } from '~helpers/useSheet'
import {
  completeOnboardingAtom,
  featureOnboardingModalAtom,
  onboardingCurrentStepAtom,
} from './atoms'
import OnboardingFooter from './components/OnboardingFooter'
import OnboardingStep from './components/OnboardingStep'
import { getOnboardingConfig, type OnboardingId } from './onboardingConfig'
const FeatureOnboardingModal = () => {
  const { t } = useTranslation()

  const [modalState, setModalState] = useAtom(featureOnboardingModalAtom)
  const completeOnboarding = useSetAtom(completeOnboardingAtom)
  const { ref, open, close } = useSheet()

  // Atoms for footer state
  const [currentStep, setCurrentStep] = useAtom(onboardingCurrentStepAtom)

  const config = modalState ? getOnboardingConfig(modalState.onboardingId as OnboardingId, t) : null
  const totalSteps = config?.steps.length ?? 0
  const step = config?.steps[currentStep] ?? null
  const isLast = currentStep === totalSteps - 1

  const handleBack = () => {
    setCurrentStep(step => Math.max(0, step - 1))
  }

  const handleNext = () => {
    if (isLast && modalState) {
      completeOnboarding(modalState.onboardingId)
      close()
      setModalState(false)
    } else {
      setCurrentStep(step => step + 1)
    }
  }

  // Auto-open when modalState changes
  // The effect synchronizes React state with the imperative native sheet API.
  // https://react.dev/learn/you-might-not-need-an-effect#subscribing-to-an-external-store
  useEffect(() => {
    if (modalState) {
      setCurrentStep(0)
      open()
    }
  }, [modalState, setCurrentStep, open])

  const handleClose = () => {
    if (modalState) {
      completeOnboarding(modalState.onboardingId)
      setModalState(false)
    }
  }

  if (!config) return null

  return (
    <Sheet modalTitle={step?.title} ref={ref} dismissible={false} onDismiss={handleClose}>
      <SheetView>
        <TouchableBox
          className="border-continuous overflow-hidden items-center justify-center rounded-[20px] bg-reverse border-[1px] border-border absolute top-[10px] right-[10px] z-[1000]"
          accessibilityLabel={t('Fermer')}
          accessibilityRole="button"
          onPress={() => {
            ref?.current?.close()
            handleClose()
          }}
          style={{ width: 30, height: 30 }}
        >
          <FeatherIcon name="x" size={14} color="default" />
        </TouchableBox>
        {step !== null && <OnboardingStep step={step} />}
        <OnboardingFooter
          currentStep={currentStep}
          totalSteps={totalSteps}
          onBack={handleBack}
          onNext={handleNext}
        />
      </SheetView>
    </Sheet>
  )
}

export default FeatureOnboardingModal
