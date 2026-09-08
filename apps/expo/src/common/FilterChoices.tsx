import { useState } from 'react'
import { Platform, TextInput } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '~themes/ThemeProvider'
import Box, { TouchableBox } from './ui/Box'
import Text from './ui/Text'
import Checkbox from './ui/Checkbox'
import { FeatherIcon } from './ui/Icon'
import type { FiltersHeaderItem } from './FiltersHeader'

export default function FilterChoices({
  options,
  searchable,
  showCheckbox,
  query: controlledQuery,
}: {
  options: NonNullable<FiltersHeaderItem['options']>
  searchable?: boolean
  showCheckbox?: boolean
  query?: string
}) {
  const [query, setQuery] = useState('')
  const searchQuery = controlledQuery ?? query
  const { t } = useTranslation()
  const theme = useTheme()
  const isWeb = Platform.OS === 'web'
  const visible = options.filter(
    option =>
      !searchQuery.trim() ||
      option.label.toLocaleLowerCase().includes(searchQuery.trim().toLocaleLowerCase())
  )
  return (
    <>
      {searchable && (
        <TextInput
          accessibilityLabel={t('Rechercher')}
          placeholder={t('Rechercher')}
          value={query}
          onChangeText={setQuery}
          style={{
            color: theme.colors.default,
            borderColor: theme.colors.border,
            borderWidth: 1,
            borderRadius: 8,
            margin: 8,
            padding: 12,
          }}
        />
      )}
      {visible.map(option => (
        <TouchableBox
          key={option.key}
          accessibilityRole={showCheckbox ? 'checkbox' : 'radio'}
          accessibilityState={{ checked: option.selected }}
          className={
            isWeb
              ? 'w-full flex-row items-center gap-3 p-3 rounded-lg'
              : 'w-full flex-row items-center gap-3 p-[16px] border-b-[1px] border-border'
          }
          onPress={option.onSelect}
        >
          {showCheckbox && <Checkbox checked={option.selected} size={isWeb ? 22 : 24} />}
          {!!option.color && (
            <Box className="w-5 h-5 rounded-md" style={{ backgroundColor: option.color }} />
          )}
          <Text className={isWeb ? 'flex-1 text-[14px]' : 'flex-1 text-[16px]'}>
            {option.label}
          </Text>
          {!showCheckbox && option.selected && (
            <FeatherIcon name="check" size={isWeb ? 17 : 20} color="primary" />
          )}
        </TouchableBox>
      ))}
      {!visible.length && <Text className="p-3 text-tertiary">{t('Aucun résultat')}</Text>}
    </>
  )
}
