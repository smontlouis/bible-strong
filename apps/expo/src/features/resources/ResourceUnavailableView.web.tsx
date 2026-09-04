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
    <Box flex={size === 'large' ? 1 : undefined} center padding={padding}>
      <Box center maxWidth={320}>
        <FeatherIcon name="wifi-off" size={size === 'small' ? 20 : 72} color="tertiary" />
        <Text textAlign="center" marginTop={padding}>
          {title}
        </Text>
        <Text textAlign="center" color="tertiary" marginTop={8}>
          {t('resource.web.connectionRequired')}
        </Text>
        {onRetry && (
          <Text bold color="primary" marginTop={padding} onPress={onRetry}>
            {t('bible.error.retry')}
          </Text>
        )}
      </Box>
    </Box>
  )
}

export default ResourceUnavailableView
