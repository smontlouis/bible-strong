import React, { useMemo } from 'react'

import { atom } from 'jotai/vanilla'
import generateUUID from '~helpers/generateUUID'
import { SearchTab } from '../../state/tabs'
import SearchTabScreen from './SearchTabScreen'

const SearchScreen = () => {
  const onTheFlyAtom = useMemo(
    () =>
      atom<SearchTab>({
        id: `search-${generateUUID()}`,
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

  return <SearchTabScreen searchAtom={onTheFlyAtom} />
}
export default SearchScreen
