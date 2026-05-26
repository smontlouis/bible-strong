import React, { useCallback } from 'react'

import withLoginModal from '~common/withLoginModal'

import { produce } from 'immer'
import { useRouter } from 'expo-router'
import { useAtom } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import { StudyTab } from '../../state/tabs'
import AllStudiesTabScreen from './AllStudiesTabScreen'
import EditStudyScreen from './EditStudyScreen'

interface StudiesTabScreenProps {
  studyAtom: PrimitiveAtom<StudyTab>
  isFormSheet?: boolean
}

const StudiesTabScreen = ({ studyAtom, isFormSheet = false }: StudiesTabScreenProps) => {
  const router = useRouter()
  const [studyTab, setStudyTab] = useAtom(studyAtom)

  const {
    data: { studyId },
    hasBackButton,
  } = studyTab

  const onStudySelect = useCallback(
    (id: string) => {
      if (isFormSheet) {
        router.push({ pathname: '/edit-study', params: { studyId: id } })
        return
      }

      setStudyTab(
        produce(draft => {
          draft.data.studyId = id
        })
      )
    },
    [isFormSheet, router, setStudyTab]
  )

  const onGoBack = useCallback(() => {
    setStudyTab(
      produce(draft => {
        draft.data.studyId = undefined
        draft.title = 'Études'
      })
    )
  }, [setStudyTab])

  if (!studyId) {
    return (
      <AllStudiesTabScreen
        hasBackButton={hasBackButton}
        isFormSheet={isFormSheet}
        onStudySelect={onStudySelect}
      />
    )
  }

  return (
    <EditStudyScreen
      studyAtom={studyAtom}
      studyId={studyId}
      hasBackButton={isFormSheet}
      openedFromTab={!isFormSheet}
      isFormSheet={isFormSheet}
      onGoBack={isFormSheet ? undefined : onGoBack}
    />
  )
}

export default withLoginModal(StudiesTabScreen)
