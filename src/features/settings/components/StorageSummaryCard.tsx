import React, { useEffect, useState } from 'react'
import * as FileSystem from 'expo-file-system/legacy'
import { useTheme } from '@emotion/react'
import { useTranslation } from 'react-i18next'
import { useAtomValue } from 'jotai/react'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import { downloadCompletionSignalAtom } from '~state/downloadQueue'
import { BASE_SQLITE_DIR } from '~helpers/databaseTypes'

const formatBytes = (
  bytes: number,
  t: (key: string, opts?: Record<string, unknown>) => string
): string => {
  if (bytes >= 1_073_741_824)
    return t('downloads.size.gb', { value: (bytes / 1_073_741_824).toFixed(1) })
  if (bytes >= 1_048_576) return t('downloads.size.mb', { value: (bytes / 1_048_576).toFixed(0) })
  if (bytes >= 1_024) return t('downloads.size.kb', { value: (bytes / 1_024).toFixed(0) })
  return t('downloads.size.b', { value: bytes })
}

const StorageSummaryCard = () => {
  const { t } = useTranslation()
  const theme = useTheme()
  const [usedBytes, setUsedBytes] = useState(0)
  const [freeBytes, setFreeBytes] = useState(0)
  const completionSignal = useAtomValue(downloadCompletionSignalAtom)

  useEffect(() => {
    calculateStorage()
  }, [completionSignal])

  const calculateStorage = async () => {
    try {
      // Calculate used storage from SQLite directory
      let total = 0

      const sqliteDir = await FileSystem.getInfoAsync(BASE_SQLITE_DIR)
      if (sqliteDir.exists) {
        total += await getDirSize(BASE_SQLITE_DIR)
      }

      setUsedBytes(total)

      const free = await FileSystem.getFreeDiskStorageAsync()
      setFreeBytes(free)
    } catch (e) {
      console.error('[StorageSummary] Error calculating storage:', e)
    }
  }

  const totalAvailable = usedBytes + freeBytes
  const progressRatio = totalAvailable > 0 ? usedBytes / totalAvailable : 0

  return (
    <Box mx={16} mt={16} p={16} borderRadius={12} bg="border" row alignItems="center" gap={12}>
      <FeatherIcon name="hard-drive" size={20} color="tertiary" />
      <Box flex>
        <Text fontSize={13} color="default">
          {t('downloads.storageUsed', { used: formatBytes(usedBytes, t) })}
        </Text>
        <Box mt={6} height={4} borderRadius={2} bg="reverse" overflow="hidden">
          <Box
            height={4}
            borderRadius={2}
            bg="primary"
            width={`${Math.min(progressRatio * 100, 100)}%` as any}
          />
        </Box>
      </Box>
    </Box>
  )
}

async function getDirSize(dirPath: string): Promise<number> {
  let total = 0
  try {
    const entries = await FileSystem.readDirectoryAsync(dirPath)
    for (const entry of entries) {
      const entryPath = `${dirPath}/${entry}`
      const info = await FileSystem.getInfoAsync(entryPath)
      if (info.exists) {
        if (info.isDirectory) {
          total += await getDirSize(entryPath)
        } else if (info.size) {
          total += info.size
        }
      }
    }
  } catch {
    // Ignore errors for individual files/dirs
  }
  return total
}

export default StorageSummaryCard
