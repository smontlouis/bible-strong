import React, { useEffect, useState } from 'react'
import Modal from 'react-native-modalbox'
import styled from '@emotion/native'
import useLanguage from '~helpers/useLanguage'
import { deleteAllDatabases } from '~helpers/database'

import OnBoardingSlides from './OnBoardingSlides'
import DownloadFiles from './DownloadFiles'
import { getIfVersionNeedsDownload } from '~helpers/bibleVersions'
import { defaultBibleAtom, useBibleTabActions } from '../../state/tabs'

const StylizedModal = styled(Modal)(({ theme }) => ({
  backgroundColor: theme.colors.reverse,
}))

const useCheckMandatoryVersions = () => {
  const isFR = useLanguage()
  const [isFirstTime, setFirstTime] = useState(false)

  const actions = useBibleTabActions(defaultBibleAtom)
  useEffect(() => {
    ;(async () => {
      const lsgNeedsDownload = await getIfVersionNeedsDownload(
        isFR ? 'LSG' : 'KJV'
      )
      if (lsgNeedsDownload) {
        console.log('Needs download, open onboarding.')
        actions.setSelectedVersion(isFR ? 'LSG' : 'KJV')
        deleteAllDatabases()
        setFirstTime(true)
      } else {
        setFirstTime(false)
      }
    })()
  }, [isFR])

  return { isFirstTime, setFirstTime }
}

const OnBoarding = () => {
  const [step, setStep] = React.useState(0)
  const { isFirstTime, setFirstTime } = useCheckMandatoryVersions()

  return (
    <StylizedModal
      isOpen={isFirstTime}
      backdropPressToClose={false}
      swipeToClose={false}
    >
      {step === 0 && <OnBoardingSlides setStep={setStep} />}
      {step === 1 && (
        <DownloadFiles setStep={setStep} setFirstTime={setFirstTime} />
      )}
    </StylizedModal>
  )
}

export default OnBoarding
