import React, { useCallback } from 'react'

import produce from 'immer'
import { PrimitiveAtom } from 'jotai/vanilla'
import { useAtom } from 'jotai/react'
import { StrongTab } from '../../state/tabs'
import LexiqueListScreen from './LexiqueListScreen'
import StrongDetailScreen from './StrongDetailScreen'

interface StrongTabScreenProps {
  strongAtom: PrimitiveAtom<StrongTab>
}

const StrongTabScreen = ({ strongAtom }: StrongTabScreenProps) => {
  const [strongTab, setStrongTab] = useAtom(strongAtom)

  const {
    data: { reference, strongReference },
    hasBackButton,
  } = strongTab

  // Determine if we're in list or detail view
  const hasDetail = reference || strongReference

  const onStrongSelect = useCallback(
    (book: number, ref: string) => {
      setStrongTab(
        produce(draft => {
          draft.data.book = book
          draft.data.reference = ref
          draft.data.strongReference = undefined
        })
      )
    },
    [setStrongTab]
  )

  if (!hasDetail) {
    return (
      <LexiqueListScreen
        hasBackButton={hasBackButton}
        strongAtom={strongAtom}
        onStrongSelect={onStrongSelect}
      />
    )
  }

  return (
    <StrongDetailScreen
      strongAtom={strongAtom}
    />
  )
}

export default StrongTabScreen
