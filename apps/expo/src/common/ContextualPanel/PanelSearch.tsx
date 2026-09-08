import Box from '~common/ui/Box'
import { TextInput } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '~themes/ThemeProvider'

export default function PanelSearch({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const { t } = useTranslation()
  const theme = useTheme()
  return (
    <Box className="self-stretch m-2">
      <TextInput
        accessibilityLabel={t('Rechercher')}
        placeholder={t('Rechercher')}
        value={value}
        onChangeText={onChange}
        style={{
          color: theme.colors.default,
          borderColor: theme.colors.border,
          borderWidth: 1,
          borderRadius: 8,
          width: '100%',
          padding: 12,
        }}
      />
    </Box>
  )
}
