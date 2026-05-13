import React, { useMemo } from 'react'

import { atom } from 'jotai/vanilla'
import { useLocalSearchParams } from 'expo-router'
import generateUUID from '~helpers/generateUUID'
import { DictionaryTab } from '../../state/tabs'
import DictionaryDetailTabScreen from './DictionaryDetailTabScreen'

const DictionaryDetailScreen = () => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  return <DictionaryDetailTabScreen dictionaryAtom={onTheFlyAtom} />
}
export default DictionaryDetailScreen
