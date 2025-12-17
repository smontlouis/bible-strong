import React, { useMemo } from 'react'

import { atom } from 'jotai/vanilla'
import { StackScreenProps } from '@react-navigation/stack'
import { CompareTab } from '../../state/tabs'
import CompareVersesTabScreen from './CompareVersesTabScreen'
import { MainStackProps } from '~navigation/type'

const CompareVersesScreen = ({
  navigation,
  route,
}: StackScreenProps<MainStackProps, 'BibleCompareVerses'>) => {
  const { selectedVerses } = route.params || {}

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

  return <CompareVersesTabScreen compareAtom={onTheFlyAtom} navigation={navigation} />
}
export default CompareVersesScreen
