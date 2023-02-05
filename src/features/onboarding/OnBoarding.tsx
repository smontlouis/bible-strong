import styled from '@emotion/native'
import React, { useEffect, useState } from 'react'
import Modal from 'react-native-modal'
import { deleteAllDatabases } from '~helpers/database'
import useLanguage from '~helpers/useLanguage'

import { atom } from 'jotai/vanilla'
import { getIfVersionNeedsDownload } from '~helpers/bibleVersions'
import { defaultBibleAtom, useBibleTabActions } from '../../state/tabs'
import DownloadResources from './DownloadResources'
import OnBoardingSlides from './OnBoardingSlides'
import SelectResources from './SelectResources'

export type ResourceToDownload = {
  id: string
  name: string
  path: string
  uri: string
  fileSize: number
}

export const selectedResourcesAtom = atom<ResourceToDownload[]>([])

const StylizedModal = styled(Modal)(({ theme }) => ({
  backgroundColor: theme.colors.reverse,
  width: '100%',
  margin: 0,
  padding: 0,
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
    <StylizedModal isVisible={isFirstTime}>
      {step === 0 && <OnBoardingSlides setStep={setStep} />}
      {step === 1 && <SelectResources setStep={setStep} />}
      {step === 2 && <DownloadResources setFirstTime={setFirstTime} />}
    </StylizedModal>
  )
}

export default OnBoarding
