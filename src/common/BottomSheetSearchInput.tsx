import { useTheme } from '@emotion/react'
import * as Icon from '@expo/vector-icons'
import React from 'react'
import { TextInputProps } from 'react-native'
import Box from '~common/ui/Box'
import { FeatherIcon } from './ui/Icon'
import { BottomSheetTextInput } from '~common/bottom-sheet'

interface Props {
  onChangeText: (text: string) => void
  value: string
  placeholder: string
  onDelete: () => void
}

const BottomSheetSearchInput = ({
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
        paddingHorizontal={14}
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
          style={{ marginRight: 8 }}
        />
        <Box flex>
          <BottomSheetTextInput
            placeholder={placeholder}
            placeholderTextColor={theme.colors.grey}
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
        {value ? <FeatherIcon name="x" size={20} onPress={onDelete} /> : null}
      </Box>
    </Box>
  )
}

export default BottomSheetSearchInput
