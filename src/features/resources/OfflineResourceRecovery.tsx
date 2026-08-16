import DownloadRequired from '~common/DownloadRequired'
import Loading from '~common/Loading'
import Progress from '~common/ui/Progress'
import { createOfflineCopyDownloadItem } from '~helpers/downloadItemFactory'
import { downloadManager } from '~helpers/downloadManager'
import { createOfflineCopyId, type OfflineCopyIdentity } from '~helpers/offlineCopyId'
import { useDownloadItemStatus } from '~helpers/useDownloadQueue'
import { useResourceAccess } from './resourceAccess'
import { getResourceActions, resourceIdentityFromOfflineCopy } from './resourceModel'

type Props = {
  identity: OfflineCopyIdentity
  title: string
  fileSize: number
  hasBackButton?: boolean
  hasHeader?: boolean
  size?: 'small' | 'large'
}

const OfflineResourceRecovery = ({ identity, title, fileSize, ...displayProps }: Props) => {
  const resources = useResourceAccess()
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
            : { status: 'not-installed', supported: true },
        content: { status: 'offline-unavailable' },
      })
    : []

  if (isActive) {
    return (
      <Loading message={title}>
        <Progress progress={progress} />
      </Loading>
    )
  }

  return (
    <DownloadRequired
      {...displayProps}
      title={title}
      fileSize={fileSize}
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
