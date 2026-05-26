import React, { useMemo } from 'react'

import { atom } from 'jotai/vanilla'
import { useTranslation } from 'react-i18next'
import generateUUID from '~helpers/generateUUID'
import { NaveTab } from '../../state/tabs'
import NaveListScreen from './NaveListScreen'

type NaveScreenProps = {
  isFormSheet?: boolean
  isNewTabSelection?: boolean
  newTabId?: string
}

const NaveScreen = ({
  isFormSheet = false,
  isNewTabSelection = false,
  newTabId,
}: NaveScreenProps) => {
  const { t } = useTranslation()
  const onTheFlyAtom = useMemo(
    () =>
      atom<NaveTab>({
        id: `nave-${generateUUID()}`,
        title: t('Thèmes Nave'),
        isRemovable: true,
        hasBackButton: true,
        type: 'nave',
        data: {},
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  return (
    <NaveListScreen
      naveAtom={onTheFlyAtom}
      hasBackButton
      isFormSheet={isFormSheet}
      isNewTabSelection={isNewTabSelection}
      newTabId={newTabId}
    />
  )
}
export default NaveScreen
