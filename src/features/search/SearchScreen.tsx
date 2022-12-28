import React, { useMemo } from 'react'

import { atom } from 'jotai'
import { NavigationStackScreenProps } from 'react-navigation-stack'
import { SearchTab } from '~state/tabs'
import SearchTabScreen from './SearchTabScreen'

interface SearchScreenProps {
  verse: string
}

const SearchScreen = ({
  navigation,
}: NavigationStackScreenProps<SearchScreenProps>) => {
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
