import React from 'react'

import { produce } from 'immer'
import { PrimitiveAtom } from 'jotai/vanilla'
import { useAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { StrongTab } from '../../state/tabs'
import LexiqueListScreen from './LexiqueListScreen'
import StrongMainScreen from './StrongMainScreen'

interface StrongTabScreenProps {
  strongAtom: PrimitiveAtom<StrongTab>
}

const StrongTabScreen = ({ strongAtom }: StrongTabScreenProps) => {
  const { t } = useTranslation()
  const [strongTab, setStrongTab] = useAtom(strongAtom)

  const {
    data: { reference, strongReference },
    hasBackButton,
  } = strongTab

  // Determine if we're in list or detail view
  const hasDetail = reference || strongReference

  const onStrongSelect = (book: number, ref: string) => {
    setStrongTab(
      produce(draft => {
        draft.data.book = book
        draft.data.reference = ref
        draft.data.strongReference = undefined
      })
    )
  }

  const returnToLexicon = () => {
    setStrongTab(
      produce(draft => {
        draft.title = t('Lexique')
        draft.data = {}
      })
    )
  }

  const updateTitle = (title: string) => {
    setStrongTab(
      produce(draft => {
        draft.title = title
      })
    )
  }

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
    <StrongMainScreen
      context={strongTab.data}
      onBack={returnToLexicon}
      onTitleChange={updateTitle}
    />
  )
}

export default StrongTabScreen
