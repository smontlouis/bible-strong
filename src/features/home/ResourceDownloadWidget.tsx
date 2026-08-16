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
import { itemHeight, itemWidth } from './widget'
import { useResourceAccess } from '~features/resources/resourceAccess'
import {
  getResourceActions,
  resourceIdentityFromOfflineCopy,
  type OfflineCopyState,
} from '~features/resources/resourceModel'

type Props = {
  identity: OfflineCopyIdentity
  title: string
  fileSize: number
}

const ResourceDownloadWidget = ({ identity, title, fileSize }: Props) => {
  const { t } = useTranslation()
  const resources = useResourceAccess()
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
      })
    : []
  const canAcquire = actions.includes('make-available-offline') || actions.includes('retry')

  const startDownload = () => {
    if (!canAcquire) return
    if (queue?.status === 'failed') {
      downloadManager.retry(offlineCopyId)
    } else {
      downloadManager.enqueue([createOfflineCopyDownloadItem(identity)])
    }
  }

  return (
    <AnimatedTouchableBox
      accessibilityRole="button"
      accessibilityLabel={
        isActive ? `${title}. ${t('Téléchargement en cours')}` : `${title}. ${fileSize} Mo`
      }
      accessibilityState={{ disabled: isActive }}
      activeOpacity={1}
      disabled={isActive}
      onPress={startDownload}
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
      center
      rounded
      height={itemHeight}
      width={itemWidth}
      marginRight={16}
      paddingHorizontal={16}
      bg="border"
      bgOpacity="030"
      borderWidth={1.5}
      borderStyle="dashed"
      borderColor="border"
      style={{
        transform: [{ scale: isPressed ? 0.96 : 1 }],
        transitionProperty: 'transform',
        transitionDuration: 140,
      }}
    >
      {isActive ? (
        <>
          <Progress progress={progress} size={30} thickness={2} />
          <Text color="tertiary" marginTop={12} fontSize={12} textAlign="center">
            {t('Téléchargement en cours')}
          </Text>
        </>
      ) : (
        <>
          <FeatherIcon name="download-cloud" size={24} color="tertiary" />
          <Text color="tertiary" bold marginTop={10} textAlign="center" fontSize={12}>
            {title}
          </Text>
          <Text color="tertiary" fontSize={11} marginTop={4}>
            {fileSize} Mo
          </Text>
        </>
      )}
    </AnimatedTouchableBox>
  )
}

export default ResourceDownloadWidget
