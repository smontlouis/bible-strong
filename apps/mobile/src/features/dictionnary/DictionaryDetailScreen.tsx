import React, { useMemo } from 'react'

import { atom } from 'jotai/vanilla'
import { useLocalSearchParams } from 'expo-router'
import generateUUID from '~helpers/generateUUID'
import { DictionaryTab } from '../../state/tabs'
import DictionaryDetailTabScreen from './DictionaryDetailTabScreen'
import { IS_FORM_SHEET } from '~helpers/constants'

const DictionaryDetailScreen = () => {
  const params = useLocalSearchParams<{
    word?: string
    work?: string
    resourceId?: string
    dictionaryTitle?: string
  }>()

  // Parse params from URL strings
  const word = params.word || ''

  const onTheFlyAtom = useMemo(
    () =>
      atom<DictionaryTab>({
        id: `dictionary-${generateUUID()}`,
        title: 'Dictionary',
        isRemovable: true,
        hasBackButton: true,
        type: 'dictionary',
        data: {
          word,
          work: params.work,
          resourceId: params.resourceId,
          dictionaryTitle: params.dictionaryTitle,
        },
      } as DictionaryTab),
    [params.dictionaryTitle, params.resourceId, params.work, word]
  )

  return <DictionaryDetailTabScreen dictionaryAtom={onTheFlyAtom} isFormSheet={IS_FORM_SHEET} />
}
export default DictionaryDetailScreen
