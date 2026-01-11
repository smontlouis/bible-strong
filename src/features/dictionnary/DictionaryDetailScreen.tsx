import React, { useMemo } from 'react'

import { atom } from 'jotai/vanilla'
import { useLocalSearchParams, useRouter } from 'expo-router'
import generateUUID from '~helpers/generateUUID'
import { DictionaryTab } from '../../state/tabs'
import DictionaryDetailTabScreen from './DictionaryDetailTabScreen'

const DictionaryDetailScreen = () => {
  const router = useRouter()
  const params = useLocalSearchParams<{ word?: string }>()

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
        },
      } as DictionaryTab),
    []
  )

  return <DictionaryDetailTabScreen dictionaryAtom={onTheFlyAtom} navigation={router} />
}
export default DictionaryDetailScreen
