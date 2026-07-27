import { useAtomValue } from 'jotai/react'
import { useQuery } from '@tanstack/react-query'
import React from 'react'
import { ActivityIndicator, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'

import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Progress from '~common/ui/Progress'
import Text from '~common/ui/Text'
import { downloadManager } from '~helpers/downloadManager'
import { createStrongSidecarDownloadPlan } from '~helpers/downloadItemFactory'
import {
  getStrongBibleAttributionKey,
  type StrongBibleVersionId,
} from '~helpers/strongBiblePublications'
import {
  getStrongBibleSidecarAvailability,
  type StrongBibleSidecarAvailability,
} from '~helpers/strongBibleSidecar'
import { useDownloadItemStatus } from '~helpers/useDownloadQueue'
import { downloadCompletionSignalAtom, getDownloadItemProgress } from '~state/downloadQueue'

interface Props {
  versionId: StrongBibleVersionId
  expanded: boolean
  onAvailabilityChange: (isAvailable: boolean) => void
}

const isActiveDownload = (status?: string) =>
  status === 'queued' || status === 'downloading' || status === 'inserting'

const StrongIndexSelectorItem = ({ versionId, expanded, onAvailabilityChange }: Props) => {
  const { t } = useTranslation()
  const downloadCompletionSignal = useAtomValue(downloadCompletionSignalAtom)
  const bibleDownload = useDownloadItemStatus(`bible:${versionId}`)
  const strongDownload = useDownloadItemStatus(`bible-strong:${versionId}`)
  const availabilityQuery = useQuery({
    queryKey: ['strong-index-availability', versionId, downloadCompletionSignal],
    queryFn: () => getStrongBibleSidecarAvailability(versionId),
  })
  const availability = availabilityQuery.data
  const isChecking = availabilityQuery.isPending || availabilityQuery.isFetching

  React.useEffect(() => {
    onAvailabilityChange(availability?.status === 'available')
  }, [availability?.status, onAvailabilityChange])

  const strongActiveDownload = isActiveDownload(strongDownload?.status) ? strongDownload : undefined
  const failedDownload = [bibleDownload, strongDownload].find(state => state?.status === 'failed')
  const isAvailable = availability?.status === 'available'
  const progress = strongActiveDownload ? getDownloadItemProgress(strongActiveDownload) : 0

  const handlePress = async () => {
    if (isChecking || isAvailable || strongActiveDownload) return

    let resolvedAvailability: StrongBibleSidecarAvailability | undefined = availability
    if (!resolvedAvailability) {
      const result = await availabilityQuery.refetch()
      resolvedAvailability = result.data
    }

    if (resolvedAvailability) {
      downloadManager.enqueue(
        createStrongSidecarDownloadPlan(versionId, resolvedAvailability.status)
      )
    }
  }

  if (!expanded) return null

  return (
    <Box
      minHeight={52}
      pl={56}
      pr={4}
      py={6}
      justifyContent="center"
      borderBottomWidth={1}
      borderColor="border"
    >
      <Box
        pos="absolute"
        top={-10}
        left={32}
        width={16}
        height={36}
        borderLeftWidth={2}
        borderBottomWidth={2}
        borderBottomLeftRadius={10}
        borderColor="border"
      />
      <Box row alignItems="center" opacity={isAvailable ? 1 : 0.5}>
        <Box disabled flex>
          <Text fontSize={14} numberOfLines={1}>
            {t('versionSelector.strongIndex')}
          </Text>
          <Text fontSize={10} color="tertiary" mt={2} numberOfLines={2}>
            {t(getStrongBibleAttributionKey(versionId))}
          </Text>
        </Box>

        {isAvailable ? (
          <Box width={48} minHeight={40} center>
            <FeatherIcon name="check" size={18} color="primary" />
          </Box>
        ) : (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('downloads.strongIndexName', { bible: versionId })}
            accessibilityState={{ disabled: isChecking || Boolean(strongActiveDownload) }}
            activeOpacity={strongActiveDownload ? 1 : 0.7}
            disabled={isChecking || Boolean(strongActiveDownload)}
            onPress={handlePress}
          >
            <Box width={48} minHeight={40} center>
              {isChecking ? (
                <ActivityIndicator size="small" />
              ) : strongActiveDownload?.status === 'queued' ? (
                <FeatherIcon name="clock" size={18} color="tertiary" />
              ) : strongActiveDownload ? (
                <Progress progress={Math.max(progress, 0.04)} size={22} thickness={2.5} />
              ) : (
                <FeatherIcon name={failedDownload ? 'rotate-cw' : 'download-cloud'} size={16} />
              )}
            </Box>
          </TouchableOpacity>
        )}
      </Box>
    </Box>
  )
}

export default StrongIndexSelectorItem
