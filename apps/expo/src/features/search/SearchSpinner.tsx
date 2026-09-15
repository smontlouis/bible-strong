import { ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import Box from '~common/ui/Box'
import { useTheme } from '~themes/ThemeProvider'

export default function SearchSpinner({ fill = false }: { fill?: boolean }) {
  const theme = useTheme()
  const { t } = useTranslation()
  return (
    <Box
      className={
        fill ? 'flex-1 items-center justify-center' : 'items-center justify-center py-[20px]'
      }
    >
      <ActivityIndicator
        color={theme.colors.primary}
        accessibilityRole="progressbar"
        accessibilityLabel={t('Chargement...')}
      />
    </Box>
  )
}
