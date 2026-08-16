import { useAtomValue, useSetAtom } from 'jotai/react'
import { useEffect, useRef, useState } from 'react'
import { Modal } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useDispatch } from 'react-redux'

import Box from '~common/ui/Box'
import { getDefaultBibleVersion } from '~helpers/languageUtils'
import { isOnboardingForced } from '~helpers/runtimeConfig'
import useLanguage from '~helpers/useLanguage'
import { setDefaultBibleVersion } from '~redux/modules/user'
import { isOnboardingCompletedAtom } from './atom'
import AbelOnboarding from './AbelOnboarding'
import SelectResources from './SelectResources'

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
    dispatch(setDefaultBibleVersion(defaultVersion))
    setShowOnboarding(true)
  }, [lang, dispatch, isOnboardingCompleted])

  const hideOnboarding = () => {
    forcedOnboardingDismissed.current = true
    setShowOnboarding(false)
  }

  return { hideOnboarding, showOnboarding }
}

const OnBoarding = () => {
  const [step, setStep] = useState<'abel' | 'resources'>('abel')
  const setIsOnboardingCompleted = useSetAtom(isOnboardingCompletedAtom)
  const { hideOnboarding, showOnboarding } = useOptionalOnboarding()

  const completeOnboarding = () => {
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
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Box flex bg="reverse">
          {step === 'abel' ? (
            <AbelOnboarding onComplete={() => setStep('resources')} />
          ) : (
            <SelectResources onComplete={completeOnboarding} />
          )}
        </Box>
      </GestureHandlerRootView>
    </Modal>
  )
}

export default OnBoarding
