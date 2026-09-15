import React from 'react'

import { createStrongIdentityForBook } from '~helpers/strongIdentities'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import LexiqueListScreen from './LexiqueListScreen'
import { createStrongDetailRoute } from './strongDetailRoutes'

type LexiqueScreenProps = {
  initialLexicalLanguage?: 'hebrew' | 'greek'
  isFormSheet?: boolean
  isNewTabSelection?: boolean
  newTabId?: string
}

const LexiqueScreen = ({
  initialLexicalLanguage,
  isFormSheet = false,
  isNewTabSelection = false,
  newTabId,
}: LexiqueScreenProps) => {
  const pushRouteOnce = usePushRouteOnce()
  const openStrongDetail = (book: number, reference: string) => {
    const identity = createStrongIdentityForBook(reference, book)
    pushRouteOnce(
      createStrongDetailRoute('index', {
        book,
        identityKind: identity.kind,
        identityCode: identity.code,
        reference: identity.code,
      })
    )
  }

  return (
    <LexiqueListScreen
      initialLexicalLanguage={initialLexicalLanguage}
      hasBackButton
      isFormSheet={isFormSheet}
      isNewTabSelection={isNewTabSelection}
      newTabId={newTabId}
      onStrongSelect={openStrongDetail}
    />
  )
}
export default LexiqueScreen
