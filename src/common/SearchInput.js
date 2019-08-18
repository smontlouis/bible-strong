import React from 'react'
import * as Icon from '@expo/vector-icons'

import Box from '~common/ui/Box'
import Border from '~common/ui/Border'
import TextInput from '~common/ui/TextInput'

const SearchInput = ({ onChangeText, value, placeholder }) => (
  <Box>
    <Box row center padding={10}>
      <Icon.Feather name="search" size={20} style={{ marginRight: 10 }} />
      <TextInput
        placeholder={placeholder}
        onChangeText={onChangeText}
        returnKeyType="send"
        style={{ flex: 1 }}
        value={value}
      />
    </Box>
    <Border />
  </Box>
)

export default SearchInput
