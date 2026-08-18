import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'

import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import type { OfflineCopyIdentity } from '~helpers/offlineCopyId'
import useConnection from '~helpers/useConnection'
import OfflineResourceRecovery from './OfflineResourceRecovery'
import { getResourceFailurePresentation, type ResourceFailure } from './resourceFailure'

type Props = {
  identity?: OfflineCopyIdentity
  title: string
  fileSize?: number
  failure: ResourceFailure
  onRetry?: () => void
  onManage?: () => void
  size?: 'small' | 'large'
}

const ResourceUnavailableView = ({
  identity,
  title,
  fileSize,
  failure,
  onRetry,
  onManage,
  size = 'large',
}: Props) => {
  const { t } = useTranslation()
  const router = useRouter()
  const isOnline = useConnection()
  const presentation = getResourceFailurePresentation(failure, { isOnline })

  if (
    identity &&
    fileSize != null &&
    (presentation.actions.includes('download') || presentation.actions.includes('repair'))
  ) {
    const secondaryActions = [
      ...(presentation.actions.includes('retry') && onRetry
        ? [{ label: t('bible.error.retry'), onPress: onRetry }]
        : []),
      ...(presentation.actions.includes('manage')
        ? [
            {
              label: t('bible.error.goToDownloads'),
              onPress: onManage ?? (() => router.push('/downloads')),
            },
          ]
        : []),
    ]
    return (
      <OfflineResourceRecovery
        identity={identity}
        title={title}
        fileSize={fileSize}
        icon={presentation.icon}
        reason={presentation.actions.includes('repair') ? 'invalid-offline-copy' : undefined}
        size={size}
        secondaryActions={secondaryActions}
      />
    )
  }

  const padding = size === 'small' ? 10 : 30
  return (
    <Box flex={size === 'large' ? 1 : undefined} center padding={padding}>
      <Box center maxWidth={320}>
        <FeatherIcon name={presentation.icon} size={size === 'small' ? 20 : 72} color="tertiary" />
        <Text textAlign="center" marginTop={padding}>
          {title}
        </Text>
        <Text textAlign="center" color="tertiary" marginTop={8}>
          {t(presentation.detailKey)}
        </Text>
        {presentation.connectionRequired && (
          <Text textAlign="center" color="tertiary" marginTop={8}>
            {t('resource.action.connectionRequired')}
          </Text>
        )}
        {presentation.actions.includes('retry') && onRetry && (
          <Text bold color="primary" marginTop={padding} onPress={onRetry}>
            {t('bible.error.retry')}
          </Text>
        )}
        {presentation.actions.includes('manage') && (
          <Text
            bold
            color="primary"
            marginTop={padding}
            onPress={onManage ?? (() => router.push('/downloads'))}
          >
            {t('bible.error.goToDownloads')}
          </Text>
        )}
      </Box>
    </Box>
  )
}

export default ResourceUnavailableView
