import React, { useMemo } from 'react'

import { atom } from 'jotai/vanilla'
import { StackScreenProps } from '@react-navigation/stack'
import { StudyTab } from '../../state/tabs'
import StudiesTabScreen from './StudiesTabScreen'
import { MainStackProps } from '~navigation/type'

const StudiesScreen = ({
  navigation,
  route
}: StackScreenProps<MainStackProps, 'Studies'>) => {
  const studyId = route.params?.studyId // need to fix routing through LinkItem : params shouldn't be undefined

  const onTheFlyAtom = useMemo(
    () =>
      atom<StudyTab>({
        id: `study-${Date.now()}`,
        title: 'Etudes',
        isRemovable: true,
        hasBackButton: true,
        type: 'study',
        data: {
          studyId,
        },
      } as StudyTab),
    []
  )

  return <StudiesTabScreen studyAtom={onTheFlyAtom} navigation={navigation} route={route} />
}
export default StudiesScreen
