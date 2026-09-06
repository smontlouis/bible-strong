import { useTranslation } from 'react-i18next'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import type { OfflineCopyIdentity } from '~helpers/offlineCopyId'
import type { ResourceFailure } from './resourceFailure'
type Props = {
  identity?: OfflineCopyIdentity
  title: string
  fileSize?: number
  failure: ResourceFailure
  onRetry?: () => void
  onManage?: () => void
  size?: 'small' | 'large'
}

const ResourceUnavailableView = ({ title, onRetry, size = 'large' }: Props) => {
  const { t } = useTranslation()
  const padding = size === 'small' ? 10 : 30

  return (
    <Box
      className="overflow-hidden border-continuous items-center justify-center"
      style={{ padding: padding, flex: size === 'large' ? 1 : undefined }}
    >
      <Box className="overflow-hidden border-continuous items-center justify-center max-w-[320px]">
        <FeatherIcon name="wifi-off" size={size === 'small' ? 20 : 72} color="tertiary" />
        <Text className="text-center" style={{ marginTop: padding }}>
          {title}
        </Text>
        <Text className="text-center text-tertiary mt-[8px]">
          {t('resource.web.connectionRequired')}
        </Text>
        {onRetry && (
          <Text className="font-bold text-primary" onPress={onRetry} style={{ marginTop: padding }}>
            {t('bible.error.retry')}
          </Text>
        )}
      </Box>
    </Box>
  )
}

export default ResourceUnavailableView
