import React, { useMemo } from 'react'

import { atom } from 'jotai/vanilla'
import { StackScreenProps } from '@react-navigation/stack'
import { SearchTab } from '../../state/tabs'
import SearchTabScreen from './SearchTabScreen'
import { MainStackProps } from '~navigation/type'

const SearchScreen = ({ navigation }: StackScreenProps<MainStackProps, 'Search'>) => {
  const onTheFlyAtom = useMemo(
    () =>
      atom<SearchTab>({
        id: `search-${Date.now()}`,
        title: 'Recherche',
        isRemovable: true,
        type: 'search',
        data: {
          searchValue: '',
          searchMode: 'online',
        },
      } as SearchTab),
    []
  )

  return <SearchTabScreen searchAtom={onTheFlyAtom} navigation={navigation} />
}
export default SearchScreen
