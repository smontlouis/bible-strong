import React from 'react'
import { atom } from 'jotai/vanilla'
import { useMemo } from 'react'
import { StackScreenProps } from '@react-navigation/stack'
import { StrongTab } from '../../state/tabs'
import StrongDetailScreen from '~features/lexique/StrongDetailScreen'
import { MainStackProps } from '~navigation/type'

const StrongScreen = ({ navigation, route }: StackScreenProps<MainStackProps, 'Strong'>) => {
  const book = route.params.book
  // @ts-ignore
  const reference = route.params.reference
  // @ts-ignore
  let strongReference = route.params.strongReference

  const onTheFlyAtom = useMemo(
    () =>
      atom<StrongTab>({
        id: `strong-${Date.now()}`,
        title: 'Lexique',
        isRemovable: true,
        hasBackButton: true,
        type: 'strong',
        data: {
          book,
          reference,
          strongReference,
        },
      } as StrongTab),
    [book, reference, strongReference]
  )

  return <StrongDetailScreen navigation={navigation} strongAtom={onTheFlyAtom} />
}

export default StrongScreen
