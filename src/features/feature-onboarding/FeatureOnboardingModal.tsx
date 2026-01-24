import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet'
import { useAtom, useSetAtom } from 'jotai/react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { renderBackdrop, useBottomSheetStyles } from '~helpers/bottomSheetHelpers'
import { useBottomSheetModal } from '~helpers/useBottomSheet'
import {
  completeOnboardingAtom,
  featureOnboardingModalAtom,
  onboardingActionsAtom,
  onboardingCurrentStepAtom,
  onboardingTotalStepsAtom,
} from './atoms'
import OnboardingFooter from './components/OnboardingFooter'
import OnboardingStep from './components/OnboardingStep'
import { getOnboardingConfig, type OnboardingId } from './onboardingConfig'

const FeatureOnboardingModal = () => {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const { key } = useBottomSheetStyles()

  const [modalState, setModalState] = useAtom(featureOnboardingModalAtom)
  const completeOnboarding = useSetAtom(completeOnboardingAtom)
  const { ref, open, close } = useBottomSheetModal()

  // Atoms for footer state
  const [currentStep, setCurrentStep] = useAtom(onboardingCurrentStepAtom)
  const setTotalSteps = useSetAtom(onboardingTotalStepsAtom)
  const setActions = useSetAtom(onboardingActionsAtom)

  const config = modalState ? getOnboardingConfig(modalState.onboardingId as OnboardingId, t) : null
  const totalSteps = config?.steps.length ?? 0
  const step = config?.steps[currentStep] ?? null
  const isLast = currentStep === totalSteps - 1

  // Update totalSteps atom when config changes
  useEffect(() => {
    setTotalSteps(totalSteps)
  }, [totalSteps, setTotalSteps])

  // Update actions atom
  useEffect(() => {
    const handleBack = () => {
      setCurrentStep(s => Math.max(0, s - 1))
    }

    const handleNext = () => {
      if (isLast && modalState) {
        completeOnboarding(modalState.onboardingId)
        close()
        setModalState(false)
      } else {
        setCurrentStep(s => s + 1)
      }
    }

    setActions({ onBack: handleBack, onNext: handleNext })
  }, [isLast, modalState, completeOnboarding, close, setModalState, setCurrentStep, setActions])

  // Auto-open when modalState changes
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
    <BottomSheetModal
      ref={ref}
      topInset={insets.top}
      bottomInset={insets.bottom + 50}
      enablePanDownToClose={false}
      enableDynamicSizing
      backdropComponent={props => renderBackdrop({ ...props, pressBehavior: 'none' })}
      onDismiss={handleClose}
      detached={true}
      key={key}
      handleComponent={() => null}
      style={{
        paddingTop: 10,
        marginHorizontal: 20,
        borderRadius: 30,
        overflow: 'hidden',
      }}
    >
      <BottomSheetView>
        <TouchableBox
          onPress={() => {
            ref?.current?.close()
            handleClose()
          }}
          center
          size={30}
          borderRadius={20}
          bg="reverse"
          borderWidth={1}
          borderColor="border"
          position="absolute"
          top={0}
          right={10}
          zIndex={1000}
        >
          <FeatherIcon name="x" size={14} color="default" />
        </TouchableBox>
        {step && <OnboardingStep step={step} />}
        <OnboardingFooter />
      </BottomSheetView>
    </BottomSheetModal>
  )
}

export default FeatureOnboardingModal
