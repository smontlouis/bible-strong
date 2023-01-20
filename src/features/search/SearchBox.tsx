import React from 'react'
import { Keyboard } from 'react-native'
import { connectSearchBox } from 'react-instantsearch-native'
import { SearchBoxProvided, SearchBoxExposed } from 'react-instantsearch-core'

import SearchInput from '~common/SearchInput'
import Box from '~common/ui/Box'

type Props = SearchBoxProvided &
  SearchBoxExposed & {
    value: string
    onChange: (value: string) => void
    onSubmit: (cb: Function, value: string) => void
    placeholder: string
    onClear: () => void
  }

const SearchBox = ({
  refine,
  value,
  onChange,
  placeholder,
  onSubmit,
  onClear,
}: Props) => {
  console.log('render SearchBox')
  return (
    <Box px={20}>
      <SearchInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        onDelete={() => {
          Keyboard.dismiss()
          refine('')
          onClear()
        }}
        onSubmitEditing={() =>
          onSubmit(() => {
            refine(value)
          }, value)
        }
        returnKeyType="search"
      />
    </Box>
  )
}

export default connectSearchBox(SearchBox)
