import React, { useState } from 'react'

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
    entryId?: string
    correspondenceId?: string
    language?: 'fr' | 'en'
  }>()

  // Parse params from URL strings
  const word = params.word || ''

  const [onTheFlyAtom] = useState(() =>
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
        entryId: params.entryId ? Number(params.entryId) : undefined,
        correspondenceId: params.correspondenceId,
        language: params.language,
      },
    } as DictionaryTab)
  )

  return <DictionaryDetailTabScreen dictionaryAtom={onTheFlyAtom} isFormSheet={IS_FORM_SHEET} />
}
export default DictionaryDetailScreen
