import { useState } from 'react'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'

import Empty from '~common/Empty'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import Progress from '~common/ui/Progress'
import Text from '~common/ui/Text'
import { BibleError } from '~helpers/bibleErrors'
import { resetBiblesDb } from '~helpers/biblesDb'
import { toast } from '~helpers/toast'
import { downloadManager } from '~helpers/downloadManager'
import { createBibleDownloadItem } from '~helpers/downloadItemFactory'
import { useDownloadItemStatus } from '~helpers/useDownloadQueue'

/**
 * Get localized error message based on error type
 */
const getErrorMessage = (error: BibleError, t: (key: string) => string): string => {
  switch (error.type) {
    case 'BIBLE_NOT_FOUND':
      return t('bible.error.versionNotFound')
    case 'CHAPTER_NOT_FOUND':
      return t('bible.error.chapterNotFound')
    case 'DATABASE_CORRUPTED':
      return t('bible.error.databaseCorrupted')
    default:
      return t('bible.error.unknown')
  }
}

const BibleErrorView = ({ error }: { error: BibleError }) => {
  const { t } = useTranslation()
  const router = useRouter()
  const [isResetting, setIsResetting] = useState(false)
  const showActions = error.type === 'DATABASE_CORRUPTED' || error.type === 'BIBLE_NOT_FOUND'

  // Subscribe to download queue state for this version (only relevant when missing)
  const downloadItemId = `bible:${error.version}`
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

  return (
    <Box flex={1}>
      <Empty source={require('~assets/images/empty.json')} message={getErrorMessage(error, t)}>
        {showActions && (
          <Box mt={20} gap={10} alignItems="center">
            {error.type === 'BIBLE_NOT_FOUND' &&
              (downloadInProgress ? (
                <Box alignItems="center" gap={12}>
                  <Progress progress={progress} />
                  <Text fontSize={14}>
                    {isInserting ? t('bible.error.inserting') : t('bible.error.downloading')}
                  </Text>
                </Box>
              ) : (
                <Button onPress={handleDownload}>{t('bible.error.downloadVersion')}</Button>
              ))}
            {error.type === 'DATABASE_CORRUPTED' && (
              <>
                <Button onPress={() => router.push('/downloads')}>
                  {t('bible.error.goToDownloads')}
                </Button>
                <Button secondary onPress={handleReset} isLoading={isResetting}>
                  {t('bible.error.resetDatabase')}
                </Button>
              </>
            )}
          </Box>
        )}
      </Empty>
    </Box>
  )
}

export default BibleErrorView
