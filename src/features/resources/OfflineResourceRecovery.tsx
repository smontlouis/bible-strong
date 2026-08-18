import DownloadRequired from '~common/DownloadRequired'
import Loading from '~common/Loading'
import Progress from '~common/ui/Progress'
import { createOfflineCopyDownloadItem } from '~helpers/downloadItemFactory'
import { downloadManager } from '~helpers/downloadManager'
import { createOfflineCopyId, type OfflineCopyIdentity } from '~helpers/offlineCopyId'
import { useDownloadItemStatus } from '~helpers/useDownloadQueue'
import { useResourceAccess } from './resourceAccess'
import { getResourceActions, resourceIdentityFromOfflineCopy } from './resourceModel'
import useConnection from '~helpers/useConnection'
import { useTranslation } from 'react-i18next'
import type { ResourceFailureIcon } from './resourceFailure'

type Props = {
  identity: OfflineCopyIdentity
  title: string
  fileSize: number
  reason?: 'offline-copy-required' | 'invalid-offline-copy'
  hasBackButton?: boolean
  hasHeader?: boolean
  size?: 'small' | 'large'
  icon?: ResourceFailureIcon
  secondaryActions?: { label: string; onPress: () => void }[]
}

const OfflineResourceRecovery = ({
  identity,
  title,
  fileSize,
  reason = 'offline-copy-required',
  ...displayProps
}: Props) => {
  const resources = useResourceAccess()
  const isConnected = useConnection()
  const { t } = useTranslation()
  const queue = useDownloadItemStatus(createOfflineCopyId(identity))
  const isActive =
    queue?.status === 'queued' || queue?.status === 'downloading' || queue?.status === 'inserting'
  const progress =
    queue?.status === 'inserting' ? queue.insertProgress : (queue?.downloadProgress ?? 0)
  const resourceIdentity = resourceIdentityFromOfflineCopy(identity)
  const actions = resourceIdentity
    ? getResourceActions({
        identity: resourceIdentity,
        operations: ['read'],
        onlineAccess: resources.capabilities.getOnlineAccess(resourceIdentity),
        offlineCopy: isActive
          ? { status: 'downloading', progress }
          : queue?.status === 'failed'
            ? { status: 'invalid', recoverable: true }
            : reason === 'invalid-offline-copy'
              ? { status: 'invalid', recoverable: true }
              : { status: 'not-installed', supported: true },
        content: { status: 'offline-unavailable' },
        connectivity: isConnected ? 'online' : 'offline',
      })
    : []

  if (isActive) {
    return (
      <Loading message={title}>
        <Progress progress={progress} />
      </Loading>
    )
  }

  const connectionRequired = actions.includes('connection-required')

  return (
    <DownloadRequired
      {...displayProps}
      title={title}
      fileSize={fileSize}
      disabled={connectionRequired}
      actionLabel={
        connectionRequired
          ? t('resource.action.connectionRequired')
          : reason === 'invalid-offline-copy'
            ? t('resource.action.repairOfflineCopy')
            : undefined
      }
      onDownload={() => {
        if (!actions.includes('make-available-offline') && !actions.includes('retry')) {
          return
        }
        if (queue?.status === 'failed') {
          downloadManager.retry(createOfflineCopyId(identity))
        } else {
          downloadManager.enqueue([createOfflineCopyDownloadItem(identity)])
        }
      }}
    />
  )
}

export default OfflineResourceRecovery
