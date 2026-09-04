import React, { useMemo } from 'react'

import { atom } from 'jotai/vanilla'
import { useLocalSearchParams } from 'expo-router'
import generateUUID from '~helpers/generateUUID'
import { CompareTab } from '../../state/tabs'
import CompareVersesTabScreen from './CompareVersesTabScreen'

const CompareVersesScreen = () => {
  const params = useLocalSearchParams<{ selectedVerses?: string }>()

  // Parse params from URL strings
  const selectedVerses = params.selectedVerses ? JSON.parse(params.selectedVerses) : undefined

  const onTheFlyAtom = useMemo(
    () =>
      atom<CompareTab>({
        id: `compare-${generateUUID()}`,
        title: 'Comparer',
        isRemovable: true,
        hasBackButton: true,
        type: 'compare',
        data: {
          selectedVerses,
        },
      } as CompareTab),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  return <CompareVersesTabScreen compareAtom={onTheFlyAtom} />
}
export default CompareVersesScreen
