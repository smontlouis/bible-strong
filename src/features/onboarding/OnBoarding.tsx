import styled from '@emotion/native'
import { useAtom } from 'jotai/react'
import React, { useEffect, useState } from 'react'
import { Modal } from 'react-native'
import { useDispatch } from 'react-redux'
import { deleteAllDatabases } from '~helpers/sqlite'
import useLanguage from '~helpers/useLanguage'
import { getDefaultBibleVersion } from '~helpers/languageUtils'

import { getIfVersionNeedsDownload } from '~helpers/bibleVersions'
import { setDefaultBibleVersion } from '~redux/modules/user'
import { isOnboardingCompletedAtom } from './atom'
import DownloadResources from './DownloadResources'
import OnBoardingSlides from './OnBoardingSlides'
import SelectResources from './SelectResources'

const ModalContainer = styled.View(({ theme }) => ({
  flex: 1,
  backgroundColor: theme.colors.reverse,
}))

const useCheckMandatoryVersions = () => {
  const lang = useLanguage()
  const dispatch = useDispatch()
  const [isOnboardingCompleted, setIsOnboardingCompleted] = useAtom(isOnboardingCompletedAtom)
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
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
  }, [lang, dispatch, isOnboardingCompleted])

  return showOnboarding
}

const OnBoarding = () => {
  const [step, setStep] = React.useState<number>(0)
  const showOnboarding = useCheckMandatoryVersions()

  return (
    <Modal visible={showOnboarding} animationType="slide" presentationStyle="fullScreen">
      <ModalContainer>
        {step === 0 && <OnBoardingSlides setStep={setStep} />}
        {step === 1 && <SelectResources setStep={setStep} />}
        {step === 2 && <DownloadResources />}
      </ModalContainer>
    </Modal>
  )
}

export default OnBoarding
