import React, { useEffect } from 'react'
import Modal from 'react-native-modalbox'
import { useSelector } from 'react-redux'
import styled from '~styled'
import { setFirstTime } from '~redux/modules/user'
import { useDispatch } from 'react-redux'
import useLanguage from '~helpers/useLanguage'
import { deleteAllDatabases } from '~helpers/database'

import { RootState } from '~redux/modules/reducer'
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

  useEffect(() => {
    ;(async () => {
      const lsgNeedsDownload = await getIfVersionNeedsDownload(
        isFR ? 'LSG' : 'KJV'
      )
      if (lsgNeedsDownload) {
        console.log('Needs download, open onboarding.')
        dispatch(setFirstTime(true))
        dispatch(setVersion(isFR ? 'LSG' : 'KJV'))
        deleteAllDatabases()
      }
    })()
  }, [dispatch, isFR])
}

const OnBoarding = () => {
  const isFirstTime = useSelector((state: RootState) => state.user.isFirstTime)
  const [step, setStep] = React.useState(0)
  useCheckMandatoryVersions()

  return (
    <StylizedModal
      isOpen={isFirstTime}
      backdropPressToClose={false}
      swipeToClose={false}
    >
      {step === 0 && <OnBoardingSlides setStep={setStep} />}
      {step === 1 && <DownloadFiles setStep={setStep} />}
    </StylizedModal>
  )
}

export default OnBoarding
