import styled from '@emotion/native'
import { useAtomValue, useSetAtom } from 'jotai/react'
import React, { useEffect } from 'react'
import Modal from 'react-native-modal'
import { useDispatch } from 'react-redux'
import { deleteAllDatabases } from '~helpers/sqlite'
import useLanguage from '~helpers/useLanguage'

import { getIfVersionNeedsDownload } from '~helpers/bibleVersions'
import { setDefaultBibleVersion } from '~redux/modules/user'
import { isOnboardingRequiredAtom } from './atom'
import DownloadResources from './DownloadResources'
import OnBoardingSlides from './OnBoardingSlides'
import SelectResources from './SelectResources'

// @ts-ignore
const StylizedModal = styled(Modal)(({ theme }) => ({
  backgroundColor: theme.colors.reverse,
  width: '100%',
  margin: 0,
  padding: 0,
}))

const useCheckMandatoryVersions = () => {
  const isFR = useLanguage()
  const dispatch = useDispatch()
  const setIsOnboardingRequired = useSetAtom(isOnboardingRequiredAtom)

  useEffect(() => {
    ;(async () => {
      try {
        const lsgNeedsDownload = await getIfVersionNeedsDownload(isFR ? 'LSG' : 'KJV')

        if (lsgNeedsDownload) {
          console.log('[Onboarding] Needs download, open onboarding.')
          setIsOnboardingRequired(true)
          dispatch(setDefaultBibleVersion(isFR ? 'LSG' : 'KJV'))
          deleteAllDatabases()
        } else {
          setIsOnboardingRequired(false)
        }
      } catch (error) {
        console.error('[Onboarding] Error checking version:', error)
        // On error, assume onboarding is required to be safe
        setIsOnboardingRequired(true)
        dispatch(setDefaultBibleVersion(isFR ? 'LSG' : 'KJV'))
      }
    })()
  }, [isFR, dispatch])
}

const OnBoarding = () => {
  const [step, setStep] = React.useState<number>(0)
  const isOnboardingRequired = useAtomValue(isOnboardingRequiredAtom)
  useCheckMandatoryVersions()

  return (
    // @ts-ignore
    <StylizedModal isVisible={isOnboardingRequired === true}>
      {step === 0 && <OnBoardingSlides setStep={setStep} />}
      {step === 1 && <SelectResources setStep={setStep} />}
      {step === 2 && <DownloadResources />}
    </StylizedModal>
  )
}

export default OnBoarding
