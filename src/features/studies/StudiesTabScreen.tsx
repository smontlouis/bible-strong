import React from 'react'

import withLoginModal from '~common/withLoginModal'

import { PrimitiveAtom } from 'jotai/vanilla'
import { useAtom } from 'jotai/react'
import { StackNavigationProp } from '@react-navigation/stack'
import { StudyTab } from '../../state/tabs'
import AllStudiesTabScreen from './AllStudiesTabScreen'
import EditStudyScreen from './EditStudyScreen'
import { MainStackProps } from '~navigation/type'
import { CommonActions, RouteProp } from '@react-navigation/native'

interface StudiesTabScreenProps {
  navigation: StackNavigationProp<MainStackProps, 'EditStudy'>
  route: RouteProp<MainStackProps, 'EditStudy'>
  studyAtom: PrimitiveAtom<StudyTab>
}

const StudiesTabScreen = ({ studyAtom, navigation, route }: StudiesTabScreenProps) => {
  const [studyTab] = useAtom(studyAtom)

  const {
    data: { studyId },
    hasBackButton,
  } = studyTab

  if (!studyId) {
    return <AllStudiesTabScreen hasBackButton={hasBackButton} navigation={navigation} />
  }

  return (
    <EditStudyScreen
      // @ts-ignore
      studyAtom={studyAtom}
      // @ts-ignore
      navigation={navigation}
      // @ts-ignore
      route={{
        ...route,
        params: {
          ...route.params,
          studyId,
          hasBackButton: false,
          openedFromTab: true,
        },
      }}
      // @ts-ignore
      studyId={studyId}
    />
  )
}

export default withLoginModal(StudiesTabScreen)
