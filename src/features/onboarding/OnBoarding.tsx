import { useAtom, useSetAtom } from 'jotai/react'
import { useEffect, useRef, useState } from 'react'
import { Modal } from 'react-native'
import { useDispatch } from 'react-redux'

import Box from '~common/ui/Box'
import { getIfVersionNeedsDownload } from '~helpers/bibleVersions'
import { getDefaultBibleVersion } from '~helpers/languageUtils'
import { isOnboardingForced } from '~helpers/runtimeConfig'
import { deleteAllDatabases } from '~helpers/sqlite'
import useLanguage from '~helpers/useLanguage'
import { setDefaultBibleVersion } from '~redux/modules/user'
import { isOnboardingCompletedAtom } from './atom'
import AbelOnboarding from './AbelOnboarding'
import SelectResources from './SelectResources'

const useCheckMandatoryVersions = () => {
  const lang = useLanguage()
  const dispatch = useDispatch()
  const [isOnboardingCompleted, setIsOnboardingCompleted] = useAtom(isOnboardingCompletedAtom)
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

    // Skip file check if onboarding was already completed (fast path via MMKV)
    if (isOnboardingCompleted) {
      console.log('[Onboarding] Already completed, skipping file check.')
      setShowOnboarding(false)
      return
    }

    const defaultVersion = getDefaultBibleVersion(lang)

    ;(async () => {
      try {
        const needsDownload = await getIfVersionNeedsDownload(defaultVersion)

        if (needsDownload) {
          console.log('[Onboarding] Needs download, open onboarding.')
          setShowOnboarding(true)
          dispatch(setDefaultBibleVersion(defaultVersion))
          deleteAllDatabases()
        } else {
          // Bible exists, mark onboarding as completed for future fast starts
          console.log('[Onboarding] Bible exists, marking as completed.')
          setIsOnboardingCompleted(true)
        }
      } catch (error) {
        console.error('[Onboarding] Error checking version:', error)
        // On error, assume onboarding is required to be safe
        setShowOnboarding(true)
        dispatch(setDefaultBibleVersion(defaultVersion))
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const { hideOnboarding, showOnboarding } = useCheckMandatoryVersions()

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
      onRequestClose={() => undefined}
    >
      <Box flex bg="reverse">
        {step === 'abel' ? (
          <AbelOnboarding onComplete={() => setStep('resources')} />
        ) : (
          <SelectResources onComplete={completeOnboarding} />
        )}
      </Box>
    </Modal>
  )
}

export default OnBoarding
