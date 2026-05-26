import React, { useMemo } from 'react'

import { atom } from 'jotai/vanilla'
import { useTranslation } from 'react-i18next'
import generateUUID from '~helpers/generateUUID'
import { DictionaryTab } from '../../state/tabs'
import DictionaryListScreen from './DictionaryListScreen'

type DictionaryScreenProps = {
  isFormSheet?: boolean
  isNewTabSelection?: boolean
  newTabId?: string
}

const DictionaryScreen = ({
  isFormSheet = false,
  isNewTabSelection = false,
  newTabId,
}: DictionaryScreenProps) => {
  const { t } = useTranslation()
  const onTheFlyAtom = useMemo(
    () =>
      atom<DictionaryTab>({
        id: `dictionary-${generateUUID()}`,
        title: t('Dictionnaire'),
        isRemovable: true,
        hasBackButton: true,
        type: 'dictionary',
        data: {},
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  return (
    <DictionaryListScreen
      dictionaryAtom={onTheFlyAtom}
      hasBackButton
      isFormSheet={isFormSheet}
      isNewTabSelection={isNewTabSelection}
      newTabId={newTabId}
    />
  )
}
export default DictionaryScreen
