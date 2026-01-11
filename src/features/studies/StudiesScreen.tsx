import React, { useMemo } from 'react'

import { atom } from 'jotai/vanilla'
import { useLocalSearchParams, useRouter } from 'expo-router'
import generateUUID from '~helpers/generateUUID'
import { StudyTab } from '../../state/tabs'
import StudiesTabScreen from './StudiesTabScreen'

const StudiesScreen = () => {
  const router = useRouter()
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

  return <StudiesTabScreen studyAtom={onTheFlyAtom} />
}
export default StudiesScreen
