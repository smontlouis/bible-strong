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
    <Box className="border-continuous overflow-hidden mx-[16px] mt-[16px] mb-[16px] p-[16px] rounded-[16px] border-[1px] border-border bg-light-grey flex-row items-center gap-[14px]">
      <Box
        className="overflow-hidden border-continuous rounded-[12px] bg-light-primary items-center justify-center"
        style={{ width: 44, height: 44 }}
      >
        <FeatherIcon name="hard-drive" size={21} color="primary" />
      </Box>
      <Box className="overflow-hidden border-continuous flex-[1]">
        <Text className="text-[15px] font-bold text-default">
          {t('downloads.offlineResourcesSize', { size: formatBytes(usedBytes, t) })}
        </Text>
        <Text className="text-[12px] text-tertiary mt-[2px]">
          {t('downloads.storageFree', {
            free: formatBytes(deviceStorage.freeBytes, t),
            total: formatBytes(totalBytes, t),
          })}
        </Text>
        <Box className="border-continuous overflow-visible mt-[10px] h-[6px] rounded-[3px] bg-reverse flex-row">
          <Box
            className="overflow-hidden border-continuous h-[6px] bg-tertiary opacity-[0.45]"
            style={{ width: `${otherUsedRatio * 100}%` }}
          />
          <Box
            className="overflow-hidden border-continuous h-[6px] bg-primary"
            style={{ width: `${Math.max(offlineRatio * 100, usedBytes > 0 ? 0.75 : 0)}%` }}
          />
        </Box>
      </Box>
    </Box>
  )
}

export default StorageSummaryCard
