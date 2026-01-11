import React, { useMemo } from 'react'

import { atom } from 'jotai/vanilla'
import { useTranslation } from 'react-i18next'
import generateUUID from '~helpers/generateUUID'
import { StrongTab } from '../../state/tabs'
import LexiqueListScreen from './LexiqueListScreen'

const LexiqueScreen = () => {
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
    []
  )

  return <LexiqueListScreen strongAtom={onTheFlyAtom} hasBackButton />
}
export default LexiqueScreen
