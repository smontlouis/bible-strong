import React from 'react'

import withLoginModal from '~common/withLoginModal'

import { PrimitiveAtom } from 'jotai/vanilla'
import { useAtom } from 'jotai/react'
import { NavigationStackProp } from 'react-navigation-stack'
import { StudyTab } from '../../state/tabs'
import AllStudiesTabScreen from './AllStudiesTabScreen'
import EditStudyScreen from './EditStudyScreen'

interface StudiesTabScreenProps {
  navigation: NavigationStackProp
  studyAtom: PrimitiveAtom<StudyTab>
}

const StudiesTabScreen = ({ studyAtom, navigation }: StudiesTabScreenProps) => {
  const [studyTab] = useAtom(studyAtom)

  const {
    data: { studyId },
    hasBackButton,
  } = studyTab

  if (!studyId) {
    return <AllStudiesTabScreen hasBackButton={hasBackButton} />
  }

  return (
    <EditStudyScreen
      studyId={studyId}
      hasBackButton={false}
      navigation={navigation}
    />
  )
}

export default withLoginModal(StudiesTabScreen)
