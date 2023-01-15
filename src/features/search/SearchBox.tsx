import React from 'react'
import { Keyboard } from 'react-native'
import { connectSearchBox } from 'react-instantsearch-native'

import SearchInput from '~common/SearchInput'
import Box from '~common/ui/Box'

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
    <Box px={20}>
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
    </Box>
  )
}

export default connectSearchBox(SearchBox)
