import React, { useMemo } from 'react'

import { atom } from 'jotai/vanilla'
import { NavigationStackScreenProps } from 'react-navigation-stack'
import { CompareTab, SelectedVerses } from '~state/tabs'
import CompareVersesTabScreen from './CompareVersesTabScreen'

interface CompareVersesScreenProps {
  selectedVerses: SelectedVerses
}

const CompareVersesScreen = ({
  navigation,
}: NavigationStackScreenProps<CompareVersesScreenProps>) => {
  const { selectedVerses } = navigation.state.params || {}

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

  return (
    <CompareVersesTabScreen
      compareAtom={onTheFlyAtom}
      navigation={navigation}
    />
  )
}
export default CompareVersesScreen
