import { useAtomValue, useSetAtom } from 'jotai/react'
import { useEffect, useRef, useState } from 'react'
import { Modal, Platform } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useDispatch } from 'react-redux'
import Box from '~common/ui/Box'
import { getDefaultBibleVersion } from '~helpers/languageUtils'
import { isOnboardingForced } from '~helpers/runtimeConfig'
import useLanguage from '~helpers/useLanguage'
import { setDefaultBibleVersion } from '~redux/modules/user'
import { isOnboardingCompletedAtom, onboardingFinishedAtom, onboardingOnScreenAtom } from './atom'
import AbelOnboarding from './AbelOnboarding'
import SelectResources from './SelectResources'
import ResourceSetupChoice from './ResourceSetupChoice'
const useOptionalOnboarding = () => {
  const lang = useLanguage()
  const dispatch = useDispatch()
  const isOnboardingCompleted = useAtomValue(isOnboardingCompletedAtom)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const forcedOnboardingDismissed = useRef(false)

  useEffect(() => {
    if (isOnboardingForced) {
      if (!forcedOnboardingDismissed.current) {
        console.log('[Onboarding] Force onboarding.')
        setShowOnboarding(true)
      }
      return
    }

    if (isOnboardingCompleted) {
      setShowOnboarding(false)
      return
    }

    const defaultVersion = getDefaultBibleVersion(lang)
    dispatch(setDefaultBibleVersion(defaultVersion, { localOnly: true }))
    setShowOnboarding(true)
  }, [lang, dispatch, isOnboardingCompleted])

  const hideOnboarding = () => {
    forcedOnboardingDismissed.current = true
    setShowOnboarding(false)
  }

  return { hideOnboarding, showOnboarding }
}

const OnBoarding = () => {
  const [step, setStep] = useState<'abel' | 'choice' | 'resources'>('abel')
  const setIsOnboardingCompleted = useSetAtom(isOnboardingCompletedAtom)
  const setOnboardingFinished = useSetAtom(onboardingFinishedAtom)
  const { hideOnboarding, showOnboarding } = useOptionalOnboarding()
  const setOnboardingOnScreen = useSetAtom(onboardingOnScreenAtom)
  useEffect(() => setOnboardingOnScreen(showOnboarding), [setOnboardingOnScreen, showOnboarding])

  // The routes the end of the onboarding leads to are pushed once the modal is gone: iOS crashes
  // when a screen with native buttons mounts while a full-screen modal is closing.
  const finishPending = useRef(false)
  const markFinished = () => {
    if (!finishPending.current) return
    finishPending.current = false
    setOnboardingFinished(true)
  }

  const completeOnboarding = () => {
    finishPending.current = true
    if (Platform.OS !== 'ios') markFinished()
    if (isOnboardingForced) {
      hideOnboarding()
      return
    }
    setIsOnboardingCompleted(true)
  }

  return (
    <Modal
      visible={showOnboarding}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={completeOnboarding}
      onDismiss={markFinished}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Box
          className="overflow-hidden border-continuous flex-[1] bg-reverse"
          accessibilityViewIsModal
          onAccessibilityEscape={completeOnboarding}
        >
          {step === 'abel' ? (
            <AbelOnboarding onComplete={() => setStep('choice')} />
          ) : step === 'choice' ? (
            <ResourceSetupChoice
              onContinueOnline={completeOnboarding}
              onPrepareOffline={() => setStep('resources')}
            />
          ) : (
            <SelectResources onComplete={completeOnboarding} />
          )}
        </Box>
      </GestureHandlerRootView>
    </Modal>
  )
}

export default OnBoarding
