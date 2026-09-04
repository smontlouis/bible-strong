import { useTheme } from '@emotion/react'
import * as Icon from '@expo/vector-icons'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { TextInput, TextInputProps } from 'react-native'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from './ui/Icon'

interface Props {
  onChangeText: (text: string) => void
  value: string
  placeholder: string
  onDelete: () => void
  inputRef?: React.RefObject<TextInput | null>
}

const SearchInput = ({
  onChangeText,
  value,
  placeholder,
  onDelete,
  inputRef,
  ...props
}: Props & TextInputProps) => {
  const theme = useTheme()
  const { t } = useTranslation()
  return (
    <Box>
      <Box
        row
        center
        paddingHorizontal={14}
        borderRadius={10}
        backgroundColor="rgba(0,0,0,0.1)"
        marginTop={0}
        marginBottom={5}
        height={36}
        overflow="visible"
      >
        <Icon.Feather
          color={theme.colors.default}
          name="search"
          size={20}
          style={{ marginRight: 8 }}
        />
        <Box flex>
          <TextInput
            ref={inputRef}
            accessibilityLabel={props.accessibilityLabel ?? placeholder}
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
        {!!value && (
          <TouchableBox
            accessibilityLabel={t('accessibility.clearSearch')}
            accessibilityRole="button"
            minWidth={44}
            minHeight={44}
            center
            onPress={onDelete}
          >
            <FeatherIcon name="x" size={20} />
          </TouchableBox>
        )}
      </Box>
    </Box>
  )
}

export default SearchInput
