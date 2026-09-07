import React from 'react'

import { produce } from 'immer'
import { PrimitiveAtom } from 'jotai/vanilla'
import { useAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { StrongTab } from '../../state/tabs'
import LexiqueListScreen from './LexiqueListScreen'
import StrongMainScreen from './StrongMainScreen'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { createStrongIdentityForBook } from '~helpers/strongIdentities'
import { createStrongDetailRoute } from './strongDetailRoutes'

interface StrongTabScreenProps {
  strongAtom: PrimitiveAtom<StrongTab>
}

const StrongTabScreen = ({ strongAtom }: StrongTabScreenProps) => {
  const { t } = useTranslation()
  const pushRouteOnce = usePushRouteOnce()
  const onStrongSelect = (book: number, reference: string) => {
    const identity = createStrongIdentityForBook(reference, book)
    pushRouteOnce(
      createStrongDetailRoute('index', {
        book,
        reference: identity.code,
        identityKind: identity.kind,
        identityCode: identity.code,
      })
    )
  }
  const [strongTab, setStrongTab] = useAtom(strongAtom)

  const {
    data: { reference, strongReference },
    hasBackButton,
  } = strongTab

  // Determine if we're in list or detail view
  const hasDetail = reference || strongReference

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
    return <LexiqueListScreen hasBackButton={hasBackButton} onStrongSelect={onStrongSelect} />
  }

  return (
    <StrongMainScreen
      context={strongTab.data}
      hasBackButton={false}
      onBack={returnToLexicon}
      onTitleChange={updateTitle}
    />
  )
}

export default StrongTabScreen
