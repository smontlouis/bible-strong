import React, { useMemo } from 'react'

import { atom } from 'jotai/vanilla'
import { useTranslation } from 'react-i18next'
import generateUUID from '~helpers/generateUUID'
import { StrongTab } from '../../state/tabs'
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
  const { t } = useTranslation()
  const onTheFlyAtom = useMemo(
    () =>
      atom<StrongTab>({
        id: `strong-${generateUUID()}`,
        title: t('Lexique'),
        isRemovable: true,
        hasBackButton: true,
        type: 'strong',
        data: {},
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  return (
    <LexiqueListScreen
      strongAtom={onTheFlyAtom}
      hasBackButton
      isFormSheet={isFormSheet}
      isNewTabSelection={isNewTabSelection}
      newTabId={newTabId}
    />
  )
}
export default LexiqueScreen
