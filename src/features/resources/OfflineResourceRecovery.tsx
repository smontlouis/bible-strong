import DownloadRequired from '~common/DownloadRequired'
import Loading from '~common/Loading'
import Progress from '~common/ui/Progress'
import { createOfflineCopyDownloadItem } from '~helpers/downloadItemFactory'
import { downloadManager } from '~helpers/downloadManager'
import { createOfflineCopyId, type OfflineCopyIdentity } from '~helpers/offlineCopyId'
import { useDownloadItemStatus } from '~helpers/useDownloadQueue'

type Props = {
  identity: OfflineCopyIdentity
  title: string
  fileSize: number
  hasBackButton?: boolean
  hasHeader?: boolean
  size?: 'small' | 'large'
}

const OfflineResourceRecovery = ({ identity, title, fileSize, ...displayProps }: Props) => {
  const queue = useDownloadItemStatus(createOfflineCopyId(identity))
  const isActive =
    queue?.status === 'queued' || queue?.status === 'downloading' || queue?.status === 'inserting'
  const progress =
    queue?.status === 'inserting' ? queue.insertProgress : (queue?.downloadProgress ?? 0)

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
      setStartDownload={start => {
        if (!start) return
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
