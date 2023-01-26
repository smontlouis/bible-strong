import React, { useMemo } from 'react'

import { atom } from 'jotai/vanilla'
import { NavigationStackScreenProps } from 'react-navigation-stack'
import { StudyTab } from '~state/tabs'
import StudiesTabScreen from './StudiesTabScreen'

interface StudiesScreenProps {
  studyId?: string
}

const StudiesScreen = ({
  navigation,
}: NavigationStackScreenProps<StudiesScreenProps>) => {
  const studyId = navigation.getParam('studyId')

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

  return <StudiesTabScreen studyAtom={onTheFlyAtom} navigation={navigation} />
}
export default StudiesScreen
