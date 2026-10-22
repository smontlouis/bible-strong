import { ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { useTheme } from '~themes/ThemeProvider'

export default function ErrorState({
  title,
  detail,
  retrying = false,
  onRetry,
}: {
  title: string
  detail: string
  retrying?: boolean
  onRetry?: () => void
}) {
  const { t } = useTranslation()
  const { colors } = useTheme()
  return (
    <Box
      accessibilityRole={retrying ? undefined : 'alert'}
      accessibilityLiveRegion="polite"
      className="bg-light-grey my-3 flex-row gap-3 rounded-[12px] p-3"
    >
      {retrying ? (
        <ActivityIndicator size="small" color={colors.grey} />
      ) : (
        <FeatherIcon name="alert-circle" size={18} color="quart" />
      )}
      <Box className="flex-1 gap-1">
        <Text className="text-[14px] font-semibold">
          {retrying ? t('assistant.errors.retrying') : title}
        </Text>
        {!retrying && <Text className="text-grey text-[13px]">{detail}</Text>}
        {!retrying && onRetry && (
          <TouchableBox accessibilityRole="button" onPress={onRetry} className="mt-1 self-start">
            <Text className="text-primary text-[14px] font-semibold">
              {t('assistant.errors.retry')}
            </Text>
          </TouchableBox>
        )}
      </Box>
    </Box>
  )
}
