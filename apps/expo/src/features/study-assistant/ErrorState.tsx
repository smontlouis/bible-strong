import { useTranslation } from 'react-i18next'
import Box, { TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import StrobiAvatar from './StrobiAvatar'

const STROBI_SIZE = 34

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
  return (
    <Box
      accessibilityRole={retrying ? undefined : 'alert'}
      accessibilityLiveRegion="polite"
      className="bg-light-grey my-3 flex-row gap-3 rounded-[12px] p-3"
    >
      {/* Strobi says it: it failed, or it is trying again. */}
      <Box
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ width: STROBI_SIZE, height: STROBI_SIZE, marginTop: -4 }}
      >
        <StrobiAvatar animation={retrying ? 'working' : 'failed'} size={STROBI_SIZE} />
      </Box>
      <Box className="flex-1 gap-1">
        <Text className="text-[14px] font-semibold">
          {retrying ? t('assistant.errors.retrying') : title}
        </Text>
        {!retrying && <Text className="text-grey text-[13px]">{detail}</Text>}
        {!retrying && onRetry && (
          <TouchableBox accessibilityRole="button" onPress={onRetry} className="mt-1 self-start">
            <Text className="text-link text-[14px] font-semibold">
              {t('assistant.errors.retry')}
            </Text>
          </TouchableBox>
        )}
      </Box>
    </Box>
  )
}
