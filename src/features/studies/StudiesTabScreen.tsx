import React from 'react'

import withLoginModal from '~common/withLoginModal'

import { PrimitiveAtom } from 'jotai/vanilla'
import { useAtom } from 'jotai/react'
import { StackNavigationProp } from '@react-navigation/stack'
import { StudyTab } from '../../state/tabs'
import AllStudiesTabScreen from './AllStudiesTabScreen'
import EditStudyScreen from './EditStudyScreen'
import { MainStackProps } from '~navigation/type'
import { RouteProp } from '@react-navigation/native'

interface StudiesTabScreenProps {
  navigation: StackNavigationProp<MainStackProps, 'EditStudy'>
  route: RouteProp<MainStackProps, 'EditStudy'>
  studyAtom: PrimitiveAtom<StudyTab>
}

const StudiesTabScreen = ({
  studyAtom,
  navigation,
  route,
}: StudiesTabScreenProps) => {
  const [studyTab] = useAtom(studyAtom)

  const {
    data: { studyId },
    hasBackButton,
  } = studyTab

  if (!studyId) {
    return <AllStudiesTabScreen hasBackButton={hasBackButton} navigation={navigation} />
  }

  navigation.setParams({ studyId: studyId })

  return (
    <EditStudyScreen
      navigation={navigation}
      route={route}
      // studyId={studyId}
      // hasBackButton={false}
      // openedFromTab
    />
  )
}

export default withLoginModal(StudiesTabScreen)
