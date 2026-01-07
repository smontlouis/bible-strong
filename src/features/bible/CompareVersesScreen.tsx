import React, { useMemo } from 'react'

import { atom } from 'jotai/vanilla'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { CompareTab } from '../../state/tabs'
import CompareVersesTabScreen from './CompareVersesTabScreen'

const CompareVersesScreen = () => {
  const router = useRouter()
  const params = useLocalSearchParams<{ selectedVerses?: string }>()

  // Parse params from URL strings
  const selectedVerses = params.selectedVerses ? JSON.parse(params.selectedVerses) : undefined

  const onTheFlyAtom = useMemo(
    () =>
      atom<CompareTab>({
        id: `compare-${Date.now()}`,
        title: 'Comparer',
        isRemovable: true,
        hasBackButton: true,
        type: 'compare',
        data: {
          selectedVerses,
        },
      } as CompareTab),
    []
  )

  return <CompareVersesTabScreen compareAtom={onTheFlyAtom} navigation={router} />
}
export default CompareVersesScreen
