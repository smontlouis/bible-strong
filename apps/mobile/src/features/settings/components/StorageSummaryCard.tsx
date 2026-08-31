import { useQuery } from '@tanstack/react-query'
import * as FileSystem from 'expo-file-system/legacy'
import { useTranslation } from 'react-i18next'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import { localQueryOptions } from '~helpers/queryOptions'
import { MOBILE_RESOURCE_CATALOG } from '~helpers/mobileResourceCatalog'
import { useOfflineResourceRegistry } from '~features/resources/useOfflineResourceRegistry'

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
    return total + (MOBILE_RESOURCE_CATALOG.resources[entry.id]?.installedBytes ?? 0)
  }, 0)
  const { data: freeBytes = 0 } = useQuery({
    queryKey: ['storage-free-space', registry.revision],
    queryFn: () => FileSystem.getFreeDiskStorageAsync(),
    ...localQueryOptions,
  })

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
            width={`${Math.min(progressRatio * 100, 100)}%`}
          />
        </Box>
      </Box>
    </Box>
  )
}

export default StorageSummaryCard
