import { useQuery } from '@tanstack/react-query'
import * as FileSystem from 'expo-file-system/legacy'
import { useTranslation } from 'react-i18next'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import { localQueryOptions } from '~helpers/queryOptions'
import { MOBILE_RESOURCE_CATALOG } from '~helpers/mobileResourceCatalog'
import { useOfflineResourceRegistry } from '~features/resources/useOfflineResourceRegistry'
import { getOfflineCopyCatalogId } from '~helpers/offlineCopyId'

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
  const registry = useOfflineResourceRegistry()
  const usedBytes = [...registry.resources.values()].reduce((total, entry) => {
    if (entry.availability.status !== 'available' && entry.availability.status !== 'corrupt') {
      return total
    }
    return (
      total +
      (MOBILE_RESOURCE_CATALOG.resources[getOfflineCopyCatalogId(entry.resource)]?.installedBytes ??
        0)
    )
  }, 0)
  const { data: deviceStorage = { freeBytes: 0, totalBytes: 0 } } = useQuery({
    queryKey: ['device-storage-space', registry.revision],
    queryFn: async () => {
      const [freeBytes, totalBytes] = await Promise.all([
        FileSystem.getFreeDiskStorageAsync(),
        FileSystem.getTotalDiskCapacityAsync(),
      ])
      return { freeBytes, totalBytes }
    },
    ...localQueryOptions,
  })

  const totalBytes = deviceStorage.totalBytes
  const offlineRatio = totalBytes > 0 ? Math.min(usedBytes / totalBytes, 1) : 0
  const otherUsedBytes = Math.max(totalBytes - deviceStorage.freeBytes - usedBytes, 0)
  const otherUsedRatio = totalBytes > 0 ? Math.min(otherUsedBytes / totalBytes, 1) : 0

  return (
    <Box
      mx={16}
      mt={16}
      p={16}
      borderRadius={16}
      borderWidth={1}
      borderColor="border"
      bg="lightGrey"
      row
      alignItems="center"
      gap={14}
    >
      <Box size={44} borderRadius={12} bg="lightPrimary" center>
        <FeatherIcon name="hard-drive" size={21} color="primary" />
      </Box>
      <Box flex>
        <Text fontSize={15} bold color="default">
          {t('downloads.offlineResourcesSize', { size: formatBytes(usedBytes, t) })}
        </Text>
        <Text fontSize={12} color="tertiary" mt={2}>
          {t('downloads.storageFree', {
            free: formatBytes(deviceStorage.freeBytes, t),
            total: formatBytes(totalBytes, t),
          })}
        </Text>
        <Box mt={10} height={6} borderRadius={3} bg="reverse" overflow="hidden" row>
          <Box height={6} bg="tertiary" opacity={0.45} width={`${otherUsedRatio * 100}%`} />
          <Box
            height={6}
            bg="primary"
            width={`${Math.max(offlineRatio * 100, usedBytes > 0 ? 0.75 : 0)}%`}
          />
        </Box>
      </Box>
    </Box>
  )
}

export default StorageSummaryCard
