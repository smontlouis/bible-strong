import { atom } from 'jotai/vanilla'

import generateUUID from '~helpers/generateUUID'
import { SearchTab } from '../../state/tabs'
import SearchTabScreen from './SearchTabScreen'

const SearchScreen = () => {
  const onTheFlyAtom = atom<SearchTab>({
    id: `search-${generateUUID()}`,
    title: 'Recherche',
    isRemovable: true,
    type: 'search',
    data: {
      searchValue: '',
    },
  } as SearchTab)

  return <SearchTabScreen searchAtom={onTheFlyAtom} />
}

export default SearchScreen
