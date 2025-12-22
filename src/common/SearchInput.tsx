import { useTheme } from '@emotion/react'
import * as Icon from '@expo/vector-icons'
import React from 'react'
import { TextInput, TextInputProps } from 'react-native'
import Box from '~common/ui/Box'
import { FeatherIcon } from './ui/Icon'

interface Props {
  onChangeText: (text: string) => void
  value: string
  placeholder: string
  onDelete: () => void
}

const SearchInput = ({
  onChangeText,
  value,
  placeholder,
  onDelete,
  ...props
}: Props & TextInputProps) => {
  const theme = useTheme()
  return (
    <Box>
      <Box
        row
        center
        paddingHorizontal={20}
        borderRadius={14}
        backgroundColor="rgba(0,0,0,0.1)"
        marginTop={0}
        marginBottom={5}
        height={44}
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
              fontSize: 15,
              color: theme.colors.default,
            }}
            {...props}
          />
        </Box>
        <FeatherIcon name="x" size={20} onPress={onDelete} />
      </Box>
    </Box>
  )
}

export default SearchInput
