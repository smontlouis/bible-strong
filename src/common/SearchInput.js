import React from 'react'
import * as Icon from '@expo/vector-icons'
import { withTheme } from 'emotion-theming'
import { TouchableOpacity } from 'react-native'
import styled from '@emotion/native'
import Box from '~common/ui/Box'
import Border from '~common/ui/Border'
import TextInput from '~common/ui/TextInput'

const CloseIcon = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.default
}))

const SearchInput = ({ onChangeText, value, placeholder, theme, onDelete }) => (
  <Box>
    <Box row center padding={10}>
      <Icon.Feather
        color={theme.colors.default}
        name="search"
        size={20}
        style={{ marginRight: 10 }}
      />
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={theme.colors.default}
        onChangeText={onChangeText}
        returnKeyType="send"
        style={{ flex: 1 }}
        value={value}
      />
      <CloseIcon name="x" size={20} onPress={onDelete} />
    </Box>
    <Border />
  </Box>
)

export default withTheme(SearchInput)
