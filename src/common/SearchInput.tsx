import React from 'react'
import { TextInput } from 'react-native'
import * as Icon from '@expo/vector-icons'
import { withTheme } from '@emotion/react'
import styled from '@emotion/native'

import Box from '~common/ui/Box'
import { MAX_WIDTH } from '~helpers/useDimensions'

const CloseIcon = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.default,
}))

const SearchInput = ({
  onChangeText,
  value,
  placeholder,
  theme,
  onDelete,
  ...props
}) => (
  <Box maxWidth={MAX_WIDTH} width="100%" marginLeft="auto" marginRight="auto">
    <Box
      row
      center
      paddingHorizontal={10}
      rounded
      backgroundColor="rgba(0,0,0,0.1)"
      margin={20}
      marginTop={0}
      marginBottom={5}
      height={50}
      overflow="visible"
    >
      <Icon.Feather
        color={theme.colors.default}
        name="search"
        size={20}
        style={{ marginRight: 10 }}
      />
      <Box flex>
        <TextInput
          placeholder={placeholder}
          placeholderTextColor={theme.colors.tertiary}
          onChangeText={onChangeText}
          returnKeyType="send"
          value={value}
          style={{
            width: '100%',
            height: '100%',
            fontSize: 18,
            color: theme.colors.default,
          }}
          {...props}
        />
      </Box>
      <CloseIcon name="x" size={20} onPress={onDelete} />
    </Box>
  </Box>
)

export default withTheme(SearchInput)
