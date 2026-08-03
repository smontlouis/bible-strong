import React from 'react'

import LexiqueListScreen from './LexiqueListScreen'

type LexiqueScreenProps = {
  isFormSheet?: boolean
  isNewTabSelection?: boolean
  newTabId?: string
}

const LexiqueScreen = ({
  isFormSheet = false,
  isNewTabSelection = false,
  newTabId,
}: LexiqueScreenProps) => {
  return (
    <LexiqueListScreen
      hasBackButton
      isFormSheet={isFormSheet}
      isNewTabSelection={isNewTabSelection}
      newTabId={newTabId}
    />
  )
}
export default LexiqueScreen
