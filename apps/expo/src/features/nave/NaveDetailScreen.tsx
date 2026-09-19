import React, { useMemo } from 'react'
import { atom } from 'jotai/vanilla'
import { useLocalSearchParams } from 'expo-router'
import generateUUID from '~helpers/generateUUID'
import { NaveTab } from '../../state/tabs'
import NaveDetailTabScreen from './NaveDetailTabScreen'
import { IS_FORM_SHEET } from '~helpers/constants'
import type { ResourceLanguage } from '~helpers/databaseTypes'

export const NaveRouteScreen = ({
  nameLower,
  name = nameLower,
  language,
}: {
  nameLower: string
  name?: string
  language?: ResourceLanguage
}) => {
  const onTheFlyAtom = useMemo(
    () =>
      atom<NaveTab>({
        id: `nave-${generateUUID()}`,
        title: 'Nave',
        isRemovable: true,
        hasBackButton: true,
        type: 'nave',
        data: { name_lower: nameLower, name, language },
      } as NaveTab),
    [language, name, nameLower]
  )

  return <NaveDetailTabScreen naveAtom={onTheFlyAtom} isFormSheet={IS_FORM_SHEET} />
}

const NaveDetailScreen = () => {
  const params = useLocalSearchParams<{ name_lower?: string; name?: string }>()

  // Parse params from URL strings
  const name_lower = params.name_lower || ''
  const name = params.name || ''

  return <NaveRouteScreen nameLower={name_lower} name={name} />
}
export default NaveDetailScreen
