import React from 'react'
import { atom } from 'jotai/vanilla'
import { useMemo } from 'react'
import { NavigationStackScreenProps } from 'react-navigation-stack'
import { StrongReference } from '~common/types'
import { StrongTab } from '../../state/tabs'
import StrongTabScreen from './StrongTabScreen'

interface StrongScreenProps {
  book: number
  reference: string
  strongReference: StrongReference
}

const StrongScreen = ({
  navigation,
}: NavigationStackScreenProps<StrongScreenProps>) => {
  const book = navigation.getParam('book')
  const reference = navigation.getParam('reference')
  let strongReference = navigation.getParam('strongReference')

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
