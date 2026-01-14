import React, { useCallback } from 'react'

import withLoginModal from '~common/withLoginModal'

import produce from 'immer'
import { useAtom } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import { StudyTab } from '../../state/tabs'
import AllStudiesTabScreen from './AllStudiesTabScreen'
import EditStudyScreen from './EditStudyScreen'

interface StudiesTabScreenProps {
  studyAtom: PrimitiveAtom<StudyTab>
}

const StudiesTabScreen = ({ studyAtom }: StudiesTabScreenProps) => {
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

  const onGoBack = useCallback(() => {
    setStudyTab(
      produce(draft => {
        draft.data.studyId = undefined
        draft.title = 'Études'
      })
    )
  }, [setStudyTab])

  if (!studyId) {
    return <AllStudiesTabScreen hasBackButton={hasBackButton} onStudySelect={onStudySelect} />
  }

  return (
    <EditStudyScreen
      studyAtom={studyAtom}
      studyId={studyId}
      hasBackButton={false}
      openedFromTab={true}
      onGoBack={onGoBack}
    />
  )
}

export default withLoginModal(StudiesTabScreen)
