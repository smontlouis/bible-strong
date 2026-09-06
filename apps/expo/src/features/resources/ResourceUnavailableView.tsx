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
  offlineTitle?: string
  fileSize?: number
  failure: ResourceFailure
  onRetry?: () => void
  onManage?: () => void
  size?: 'small' | 'large'
  mt?: number
}

const ResourceUnavailableView = ({
  identity,
  title,
  offlineTitle,
  fileSize,
  failure,
  onRetry,
  onManage,
  size = 'large',
  mt,
}: Props) => {
  const { t } = useTranslation()
  const router = useRouter()
  const isOnline = useConnection()
  const isOfflineFailure =
    !isOnline && (failure.cause === 'network-offline' || failure.cause === 'offline-copy-required')
  const isDisconnectedMissingCopy = !isOnline && failure.cause === 'offline-copy-required'
  const effectiveFailure: ResourceFailure = isDisconnectedMissingCopy
    ? { cause: 'network-offline', recoveries: onRetry ? ['retry'] : [] }
    : failure
  const presentation = getResourceFailurePresentation(effectiveFailure, { isOnline })
  const displayedTitle = isOfflineFailure && offlineTitle ? offlineTitle : title

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
    const recovery = (
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
    return mt == null ? (
      recovery
    ) : (
      <Box className="overflow-hidden border-continuous" style={{ marginTop: mt }}>
        {recovery}
      </Box>
    )
  }

  const padding = size === 'small' ? 7 : 30
  return (
    <Box
      className="overflow-hidden border-continuous items-center justify-center"
      style={{ padding: padding, marginTop: mt, flex: size === 'large' ? 1 : undefined }}
    >
      <Box className="overflow-hidden border-continuous items-center justify-center max-w-[320px]">
        <FeatherIcon name={presentation.icon} size={size === 'small' ? 20 : 72} color="tertiary" />
        <Text className="text-center font-bold" style={{ marginTop: padding }}>
          {displayedTitle}
        </Text>
        <Text
          className="text-center text-tertiary mt-[8px]"
          style={{ fontSize: size === 'small' ? 12 : 16 }}
        >
          {t(presentation.detailKey)}
        </Text>
        {presentation.connectionRequired && (
          <Text className="text-center text-tertiary mt-[8px]">
            {t('resource.action.connectionRequired')}
          </Text>
        )}
        {presentation.actions.includes('retry') && onRetry && (
          <Text
            className="font-bold text-primary"
            onPress={onRetry}
            style={{ marginTop: padding, fontSize: size === 'small' ? 12 : 16 }}
          >
            {t('bible.error.retry')}
          </Text>
        )}
        {presentation.actions.includes('manage') && (
          <Text
            className="font-bold text-primary"
            onPress={onManage ?? (() => router.push('/downloads'))}
            style={{ marginTop: padding }}
          >
            {t('bible.error.goToDownloads')}
          </Text>
        )}
      </Box>
    </Box>
  )
}

export default ResourceUnavailableView
