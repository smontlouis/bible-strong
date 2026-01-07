import React, { useMemo } from 'react'

import { atom } from 'jotai/vanilla'
import { useTranslation } from 'react-i18next'
import { NaveTab } from '../../state/tabs'
import NaveListScreen from './NaveListScreen'

const NaveScreen = () => {
  const { t } = useTranslation()
  const onTheFlyAtom = useMemo(
    () =>
      atom<NaveTab>({
        id: `nave-${Date.now()}`,
        title: t('Thèmes Nave'),
        isRemovable: true,
        hasBackButton: true,
        type: 'nave',
        data: {},
      }),
    []
  )

  return <NaveListScreen naveAtom={onTheFlyAtom} hasBackButton />
}
export default NaveScreen
