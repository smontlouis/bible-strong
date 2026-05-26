import React, { useMemo } from 'react'

import { atom } from 'jotai/vanilla'
import { useLocalSearchParams } from 'expo-router'
import generateUUID from '~helpers/generateUUID'
import { StudyTab } from '../../state/tabs'
import StudiesTabScreen from './StudiesTabScreen'

type StudiesScreenProps = {
  isFormSheet?: boolean
}

const StudiesScreen = ({ isFormSheet = false }: StudiesScreenProps) => {
  const params = useLocalSearchParams<{ studyId?: string }>()
  const studyId = params.studyId

  const onTheFlyAtom = useMemo(
    () =>
      atom<StudyTab>({
        id: `study-${generateUUID()}`,
        title: 'Etudes',
        isRemovable: true,
        hasBackButton: true,
        type: 'study',
        data: {
          studyId,
        },
      } as StudyTab),
    [studyId]
  )

  return <StudiesTabScreen studyAtom={onTheFlyAtom} isFormSheet={isFormSheet} />
}
export default StudiesScreen
