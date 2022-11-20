import React, { useEffect, useState } from 'react'
import Modal from 'react-native-modalbox'
import styled from '@emotion/native'
import { useDispatch } from 'react-redux'
import useLanguage from '~helpers/useLanguage'
import { deleteAllDatabases } from '~helpers/database'

import OnBoardingSlides from './OnBoardingSlides'
import DownloadFiles from './DownloadFiles'
import { getIfVersionNeedsDownload } from '~helpers/bibleVersions'
import { setVersion } from '~redux/modules/bible'

const StylizedModal = styled(Modal)(({ theme }) => ({
  backgroundColor: theme.colors.reverse,
}))

const useCheckMandatoryVersions = () => {
  const dispatch = useDispatch()
  const isFR = useLanguage()
  const [isFirstTime, setFirstTime] = useState(false)

  useEffect(() => {
    ;(async () => {
      const lsgNeedsDownload = await getIfVersionNeedsDownload(
        isFR ? 'LSG' : 'KJV'
      )
      if (lsgNeedsDownload) {
        console.log('Needs download, open onboarding.')
        dispatch(setVersion(isFR ? 'LSG' : 'KJV'))
        deleteAllDatabases()
        setFirstTime(true)
      } else {
        setFirstTime(false)
      }
    })()
  }, [dispatch, isFR])

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
