import React from 'react'
import { connectSearchBox } from 'react-instantsearch-native'

import SearchInput from '~common/SearchInput'

const SearchBox = ({ refine, setSearchState }) => {
  const [searchValue, setSearchValue] = React.useState('')
  return (
    <SearchInput
      value={searchValue}
      onChangeText={setSearchValue}
      placeholder="Recherche par mot ou phrase"
      onDelete={() => {
        setSearchValue('')
        refine('')
        setSearchState({ query: '' })
      }}
      onSubmitEditing={() => refine(searchValue)}
      returnKeyType="send"
    />
  )
}

export default connectSearchBox(SearchBox)
