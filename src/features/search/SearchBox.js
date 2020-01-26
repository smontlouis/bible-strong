import React from 'react'
import { connectSearchBox } from 'react-instantsearch-native'

import useDebounce from '~helpers/useDebounce'
import SearchInput from '~common/SearchInput'

const SearchBox = ({ refine, setSearchState }) => {
  const [searchValue, setSearchValue] = React.useState('')
  const debouncedSearchValue = useDebounce(searchValue, 300)

  React.useEffect(() => {
    if (debouncedSearchValue) {
      refine(debouncedSearchValue)
    } else {
      setSearchState({ query: '' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchValue])

  return (
    <SearchInput
      value={searchValue}
      onChangeText={setSearchValue}
      placeholder="Recherche par mot ou phrase"
      onDelete={() => {
        setSearchValue('')
        setSearchState({ query: '' })
      }}
      // onSubmitEditing={() => refine(searchValue)}
      returnKeyType="send"
    />
  )
}

export default connectSearchBox(SearchBox)
