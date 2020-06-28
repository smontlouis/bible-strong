import React from 'react'
import { Keyboard } from 'react-native'
import { connectSearchBox } from 'react-instantsearch-native'

import SearchInput from '~common/SearchInput'

const SearchBox = ({
  refine,
  debouncedValue,
  value,
  onChange,
  placeholder,
}) => {
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
      placeholder={placeholder}
      onDelete={() => {
        Keyboard.dismiss()
        onChange('')
      }}
      // onSubmitEditing={() => refine(searchValue)}
      returnKeyType="search"
    />
  )
}

export default connectSearchBox(SearchBox)
