import { useTheme } from '~themes/ThemeProvider'
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
    <Box className="overflow-visible border-continuous">
      <Box
        dataSet={{ focusGroup: 'true' }}
        className="border-continuous overflow-visible flex-row items-center justify-center pl-2 pr-1 rounded-full bg-[rgba(0,0,0,0.1)] mt-[0px] mb-[5px] h-[36px]"
      >
        <Icon.Feather
          color={theme.colors.default}
          name="search"
          size={20}
          style={{ marginRight: 8 }}
        />
        <Box className="overflow-hidden border-continuous flex-[1]">
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
            className="overflow-hidden border-continuous w-[36px] h-[36px] items-center justify-center"
            accessibilityLabel={t('accessibility.clearSearch')}
            accessibilityRole="button"
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
