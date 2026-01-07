import React, { useCallback } from 'react'

import withLoginModal from '~common/withLoginModal'

import produce from 'immer'
import { PrimitiveAtom } from 'jotai/vanilla'
import { useAtom } from 'jotai/react'
import { useRouter } from 'expo-router'
import { StudyTab } from '../../state/tabs'
import AllStudiesTabScreen from './AllStudiesTabScreen'
import EditStudyScreen from './EditStudyScreen'

interface StudiesTabScreenProps {
  studyAtom: PrimitiveAtom<StudyTab>
}

const StudiesTabScreen = ({ studyAtom }: StudiesTabScreenProps) => {
  const router = useRouter()
  const [studyTab, setStudyTab] = useAtom(studyAtom)

  const {
    data: { studyId },
    hasBackButton,
  } = studyTab

  const onStudySelect = useCallback(
    (id: string) => {
      setStudyTab(
        produce(draft => {
          draft.data.studyId = id
        })
      )
    },
    [setStudyTab]
  )

  if (!studyId) {
    return (
      <AllStudiesTabScreen
        hasBackButton={hasBackButton}
        onStudySelect={onStudySelect}
      />
    )
  }

  console.log('[StudiesTabScreen] studyId', studyId)

  return (
    <EditStudyScreen
      studyAtom={studyAtom}
      studyId={studyId}
      hasBackButton={false}
      openedFromTab={true}
    />
  )
}

export default withLoginModal(StudiesTabScreen)
