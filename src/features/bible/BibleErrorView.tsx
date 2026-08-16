import { useState } from 'react'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'

import Empty from '~common/Empty'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import Progress from '~common/ui/Progress'
import Text from '~common/ui/Text'
import { BibleError, getBibleErrorPresentation } from '~helpers/bibleErrors'
import { resetBiblesDb } from '~helpers/biblesDb'
import { toast } from '~helpers/toast'
import { downloadManager } from '~helpers/downloadManager'
import { createBibleDownloadItem } from '~helpers/downloadItemFactory'
import { useDownloadItemStatus } from '~helpers/useDownloadQueue'
import { createOfflineCopyId } from '~helpers/offlineCopyId'
import { useQueryClient } from '@tanstack/react-query'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import useConnection from '~helpers/useConnection'

const BibleErrorView = ({ error }: { error: BibleError }) => {
  const { t } = useTranslation()
  const router = useRouter()
  const queryClient = useQueryClient()
  const isConnected = useConnection()
  const [isResetting, setIsResetting] = useState(false)
  const canAcquire = error.recoveries?.includes('acquire-offline-copy')
  const canManage = error.recoveries?.includes('manage-offline-copies')
  const canReset = error.recoveries?.includes('reset-offline-store')
  const presentation = getBibleErrorPresentation(error.type)
  const canRetry = presentation.retryable
  const connectionRequired = canAcquire && !isConnected
  const showActions = canAcquire || canManage || canReset || canRetry

  // Subscribe to download queue state for this version (only relevant when missing)
  const downloadItemId = createOfflineCopyId({ kind: 'bible', versionId: error.version })
  const queueState = useDownloadItemStatus(downloadItemId)
  const isDownloading = queueState?.status === 'downloading'
  const isInserting = queueState?.status === 'inserting'
  const isQueued = queueState?.status === 'queued'
  const downloadInProgress = isDownloading || isInserting || isQueued
  const progress = isInserting
    ? (queueState?.insertProgress ?? 0)
    : (queueState?.downloadProgress ?? 0)

  const handleReset = async () => {
    setIsResetting(true)
    try {
      await resetBiblesDb()
      toast.success(t('bible.error.databaseRecovered'))
    } catch {
      toast.error(t('bible.error.databaseOpenFailed'))
    } finally {
      setIsResetting(false)
    }
  }

  const handleDownload = () => {
    try {
      const item = createBibleDownloadItem(error.version)
      downloadManager.enqueue([item])
    } catch (e) {
      console.error('[BibleErrorView] Failed to enqueue download:', e)
      toast.error(t('bible.error.unknown'))
    }
  }

  const handleRetry = () =>
    queryClient.invalidateQueries({ queryKey: resourceQueryKeys.bibleContent() })

  return (
    <Box flex={1}>
      <Empty
        source={require('~assets/images/empty.json')}
        message={t(`bible.error.${presentation.messageKey}`)}
      >
        {showActions && (
          <Box mt={20} gap={10} alignItems="center">
            {canRetry && <Button onPress={handleRetry}>{t('bible.error.retry')}</Button>}
            {canAcquire &&
              (downloadInProgress ? (
                <Box alignItems="center" gap={12}>
                  <Progress progress={progress} />
                  <Text fontSize={14}>
                    {isInserting ? t('bible.error.inserting') : t('bible.error.downloading')}
                  </Text>
                </Box>
              ) : (
                <Button disabled={connectionRequired} onPress={handleDownload}>
                  {connectionRequired
                    ? t('resource.action.connectionRequired')
                    : t('bible.error.downloadVersion')}
                </Button>
              ))}
            {(canManage || canReset) && (
              <>
                {canManage && (
                  <Button onPress={() => router.push('/downloads')}>
                    {t('bible.error.goToDownloads')}
                  </Button>
                )}
                {canReset && (
                  <Button secondary onPress={handleReset} isLoading={isResetting}>
                    {t('bible.error.resetDatabase')}
                  </Button>
                )}
              </>
            )}
          </Box>
        )}
      </Empty>
    </Box>
  )
}

export default BibleErrorView
