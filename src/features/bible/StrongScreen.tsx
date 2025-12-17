import React from 'react'
import { atom } from 'jotai/vanilla'
import { useMemo } from 'react'
import { StackScreenProps } from '@react-navigation/stack'
import { StrongTab } from '../../state/tabs'
import StrongTabScreen from './StrongTabScreen'
import { MainStackProps } from '~navigation/type'

const StrongScreen = ({ navigation, route }: StackScreenProps<MainStackProps, 'Strong'>) => {
  // @ts-ignore
  const book = route.params.book // navigation.getParam('book')
  // @ts-ignore
  const reference = route.params.reference // navigation.getParam('reference')
  // @ts-ignore
  let strongReference = route.params.strongReference // navigation.getParam('strongReference')

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
    []
  )

  return <StrongTabScreen navigation={navigation} strongAtom={onTheFlyAtom} />
}

export default StrongScreen
