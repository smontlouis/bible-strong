import React from 'react'
import Modal from 'react-native-modalbox'
import { useSelector } from 'react-redux'
import styled from '~styled'

import { RootState } from '~redux/modules/reducer'
import OnBoardingSlides from './OnBoardingSlides'
import DownloadFiles from './DownloadFiles'

const StylizedModal = styled(Modal)(({ theme }) => ({
  backgroundColor: theme.colors.reverse,
}))

const OnBoarding = () => {
  const isFirstTime = useSelector((state: RootState) => state.user.isFirstTime)
  const [step, setStep] = React.useState(0)

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
