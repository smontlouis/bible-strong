import React from 'react'
import * as Icon from '@expo/vector-icons'
import { withTheme } from 'emotion-theming'
import styled from '@emotion/native'
import Box from '~common/ui/Box'
import TextInput from '~common/ui/TextInput'

const CloseIcon = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.default
}))

const SearchInput = ({ onChangeText, value, placeholder, theme, onDelete, ...props }) => (
  <Box
    row
    center
    paddingVertical={5}
    paddingHorizontal={10}
    rounded
    backgroundColor="rgba(0,0,0,0.1)"
    margin={20}
    marginTop={0}
    marginBottom={5}
    overflow="visible">
    <Icon.Feather
      color={theme.colors.default}
      name="search"
      size={20}
      style={{ marginRight: 10 }}
    />
    <Box flex>
      <TextInput
        noBorder
        placeholder={placeholder}
        placeholderTextColor={theme.colors.tertiary}
        onChangeText={onChangeText}
        returnKeyType="send"
        value={value}
        {...props}
      />
    </Box>
    <CloseIcon name="x" size={20} onPress={onDelete} />
  </Box>
)

export default withTheme(SearchInput)
