import { useTranslation } from 'react-i18next'

import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import type { OfflineCopyIdentity } from '~helpers/offlineCopyId'
import OfflineResourceRecovery from './OfflineResourceRecovery'

export type ResourceUnavailableReason =
  | 'offline-copy-required'
  | 'invalid-offline-copy'
  | 'temporary-unavailable'

type Props = {
  identity: OfflineCopyIdentity
  title: string
  fileSize: number
  reason: ResourceUnavailableReason
  onRetry?: () => void
  size?: 'small' | 'large'
}

const ResourceUnavailableView = ({
  identity,
  title,
  fileSize,
  reason,
  onRetry,
  size = 'large',
}: Props) => {
  const { t } = useTranslation()

  if (reason !== 'temporary-unavailable') {
    return (
      <OfflineResourceRecovery
        identity={identity}
        title={title}
        fileSize={fileSize}
        reason={reason}
        size={size}
      />
    )
  }

  const padding = size === 'small' ? 10 : 30
  return (
    <Box flex={size === 'large' ? 1 : undefined} center padding={padding}>
      <Box center maxWidth={320}>
        <FeatherIcon name="alert-circle" size={size === 'small' ? 20 : 72} color="tertiary" />
        <Text textAlign="center" marginTop={padding}>
          {title}
        </Text>
        <Text textAlign="center" color="tertiary" marginTop={8}>
          {t('resource.action.temporarilyUnavailable')}
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
