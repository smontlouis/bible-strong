import { TextInput } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '~themes/ThemeProvider'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import ColorPicker from '~common/ColorPicker'
import { IonIcon } from '~common/ui/Icon'
export default function BookmarkForm({
  name,
  color,
  onNameChange,
  onColorChange,
  onSave,
  disabled,
}: {
  name: string
  color: string
  onNameChange: (name: string) => void
  onColorChange: (color: string) => void
  onSave: () => void
  disabled?: boolean
}) {
  const { t } = useTranslation()
  const theme = useTheme()
  return (
    <Box className="p-2 gap-3">
      <Box className="flex-row items-center gap-3">
        <IonIcon name="bookmark" size={24} color={color} />
        <TextInput
          accessibilityLabel={t('Nom')}
          value={name}
          onChangeText={onNameChange}
          style={{
            flex: 1,
            color: theme.colors.default,
            borderColor: theme.colors.border,
            borderWidth: 1,
            borderRadius: 8,
            padding: 12,
          }}
        />
      </Box>
      <Box className="h-[210px] w-full">
        <ColorPicker value={color} onChangeJS={value => onColorChange(value.hex)} />
      </Box>
      <Box className="items-end pt-2">
        <Button disabled={disabled} onPress={onSave}>
          {t('Sauvegarder')}
        </Button>
      </Box>
    </Box>
  )
}
