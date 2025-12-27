import React, { useCallback } from 'react'

import withLoginModal from '~common/withLoginModal'

import produce from 'immer'
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

const StudiesTabScreen = ({ studyAtom, navigation, route }: StudiesTabScreenProps) => {
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
        navigation={navigation}
        onStudySelect={onStudySelect}
      />
    )
  }

  console.log('[StudiesTabScreen] studyId', studyId)

  return (
    <EditStudyScreen
      studyAtom={studyAtom}
      navigation={navigation}
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
