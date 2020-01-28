import React from 'react'
import { connectSearchBox } from 'react-instantsearch-native'

import SearchInput from '~common/SearchInput'

const SearchBox = ({ refine, debouncedValue, value, onChange }) => {
  React.useEffect(() => {
    if (debouncedValue) {
      refine(debouncedValue)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedValue])

  return (
    <SearchInput
      value={value}
      onChangeText={onChange}
      placeholder="Recherche par mot, phrase ou strong"
      onDelete={() => {
        onChange('')
      }}
      autoFocus
      // onSubmitEditing={() => refine(searchValue)}
      returnKeyType="send"
    />
  )
}

export default connectSearchBox(SearchBox)
