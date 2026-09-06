import { resolveThemeColor, colorWithOpacity } from '~themes/colorValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatedTouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Progress from '~common/ui/Progress'
import Text from '~common/ui/Text'
import { createOfflineCopyDownloadItem } from '~helpers/downloadItemFactory'
import { downloadManager } from '~helpers/downloadManager'
import { createOfflineCopyId, type OfflineCopyIdentity } from '~helpers/offlineCopyId'
import { useDownloadItemStatus } from '~helpers/useDownloadQueue'
import useConnection from '~helpers/useConnection'
import { useResourceAccess } from '~features/resources/resourceAccess'
import {
  getResourceActions,
  resourceIdentityFromOfflineCopy,
  type OfflineCopyState,
} from '~features/resources/resourceModel'
import { getResourceFailurePresentation } from '~features/resources/resourceFailure'
import ResourceUnavailableView from '~features/resources/ResourceUnavailableView'
import { WidgetContainer, itemHeight, itemWidth } from './widget'
type Props = {
  identity: OfflineCopyIdentity
  title: string
  fileSize: number
  onRetry?: () => void
}

const ResourceDownloadWidget = ({ identity, title, fileSize, onRetry }: Props) => {
  const stylingTheme = useStylingTheme()

  const { t } = useTranslation()
  const resources = useResourceAccess()
  const isConnected = useConnection()
  const [isPressed, setIsPressed] = useState(false)
  const offlineCopyId = createOfflineCopyId(identity)
  const queue = useDownloadItemStatus(offlineCopyId)
  const isActive =
    queue?.status === 'queued' || queue?.status === 'downloading' || queue?.status === 'inserting'
  const progress =
    queue?.status === 'inserting' ? queue.insertProgress : (queue?.downloadProgress ?? 0)
  const resourceIdentity = resourceIdentityFromOfflineCopy(identity)
  const offlineCopy: OfflineCopyState = isActive
    ? { status: 'downloading', progress }
    : queue?.status === 'failed'
      ? { status: 'invalid', recoverable: true }
      : { status: 'not-installed', supported: true }
  const actions = resourceIdentity
    ? getResourceActions({
        identity: resourceIdentity,
        operations: ['read'],
        onlineAccess: resources.capabilities.getOnlineAccess(resourceIdentity),
        offlineCopy,
        content: { status: 'offline-unavailable' },
        connectivity: isConnected ? 'online' : 'offline',
      })
    : []
  const canAcquire = actions.includes('make-available-offline') || actions.includes('retry')
  const connectionRequired = actions.includes('connection-required')
  const failurePresentation = getResourceFailurePresentation(
    { cause: 'offline-copy-required', recoveries: ['acquire-offline-copy'] },
    { isOnline: isConnected }
  )

  const startDownload = () => {
    if (!canAcquire) return
    if (queue?.status === 'failed') {
      downloadManager.retry(offlineCopyId)
    } else {
      downloadManager.enqueue([createOfflineCopyDownloadItem(identity)])
    }
  }

  if (!isConnected) {
    return (
      <WidgetContainer>
        <ResourceUnavailableView
          title={title}
          failure={{ cause: 'network-offline', recoveries: onRetry ? ['retry'] : [] }}
          size="small"
          onRetry={onRetry}
        />
      </WidgetContainer>
    )
  }

  return (
    <AnimatedTouchableBox
      className="overflow-hidden border-continuous items-center justify-center rounded-[20px] mr-[16px] px-[16px] border-[1.5px] border-dashed border-border"
      accessibilityRole="button"
      accessibilityLabel={
        isActive ? `${title}. ${t('Téléchargement en cours')}` : `${title}. ${fileSize} Mo`
      }
      accessibilityState={{ disabled: isActive || connectionRequired }}
      activeOpacity={1}
      disabled={isActive || connectionRequired}
      onPress={startDownload}
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
      style={[
        { opacity: isActive || connectionRequired ? 0.6 : 1 },
        [
          {
            width: itemWidth,
            height: itemHeight,
            backgroundColor: colorWithOpacity(resolveThemeColor(stylingTheme, 'border'), 0.3),
            opacity: isActive || connectionRequired ? 0.6 : 1,
          },
          {
            transform: [{ scale: isPressed ? 0.96 : 1 }],
            transitionProperty: 'transform',
            transitionDuration: 140,
          },
        ],
      ]}
    >
      {isActive ? (
        <>
          <Progress progress={progress} size={30} thickness={2} />
          <Text className="text-tertiary mt-[12px] text-[12px] text-center">
            {t('Téléchargement en cours')}
          </Text>
        </>
      ) : connectionRequired ? (
        <>
          <FeatherIcon name={failurePresentation.icon} size={24} color="tertiary" />
          <Text className="text-tertiary font-bold mt-[10px] text-center text-[12px]">{title}</Text>
          <Text className="text-tertiary text-[11px] mt-[4px] text-center">
            {t('resource.action.connectionRequired')}
          </Text>
        </>
      ) : (
        <>
          <FeatherIcon name={failurePresentation.icon} size={24} color="tertiary" />
          <Text className="text-tertiary font-bold mt-[10px] text-center text-[12px]">{title}</Text>
          <Text className="text-tertiary text-[11px] mt-[4px]">{fileSize} Mo</Text>
        </>
      )}
    </AnimatedTouchableBox>
  )
}

export default ResourceDownloadWidget
