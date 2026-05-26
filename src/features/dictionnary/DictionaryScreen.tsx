import React, { useMemo } from 'react'

import { atom } from 'jotai/vanilla'
import { useTranslation } from 'react-i18next'
import generateUUID from '~helpers/generateUUID'
import { DictionaryTab } from '../../state/tabs'
import DictionaryListScreen from './DictionaryListScreen'

type DictionaryScreenProps = {
  isFormSheet?: boolean
}

const DictionaryScreen = ({ isFormSheet = false }: DictionaryScreenProps) => {
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
    <DictionaryListScreen dictionaryAtom={onTheFlyAtom} hasBackButton isFormSheet={isFormSheet} />
  )
}
export default DictionaryScreen
