import { useState } from 'react'
import { TextInput } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '~themes/ThemeProvider'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
export default function PanelTextForm({
  initialValue,
  label,
  onSave,
}: {
  initialValue: string
  label: string
  onSave: (value: string) => void
}) {
  const [value, setValue] = useState(initialValue)
  const { t } = useTranslation()
  const theme = useTheme()
  return (
    <Box className="p-[20px] gap-4">
      <TextInput
        accessibilityLabel={label}
        placeholder={label}
        value={value}
        onChangeText={setValue}
        style={{
          color: theme.colors.default,
          borderColor: theme.colors.border,
          borderWidth: 2,
          borderRadius: 10,
          padding: 12,
          fontSize: 16,
        }}
      />
      <Box className="items-end">
        <Button disabled={!value.trim()} onPress={() => onSave(value.trim())}>
          {t('Sauvegarder')}
        </Button>
      </Box>
    </Box>
  )
}
