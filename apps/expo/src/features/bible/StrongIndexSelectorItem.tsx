import React from 'react'
import { TouchableOpacity } from 'react-native'
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
import type { StrongBibleSidecarAvailability } from '~helpers/strongBibleSidecar'
import { useDownloadItemStatus } from '~helpers/useDownloadQueue'
import { createOfflineCopyId } from '~helpers/offlineCopyId'
import { getDownloadItemProgress } from '~state/downloadQueue'
import { useOfflineResourceState } from '~features/resources/useOfflineResourceRegistry'
import useConnection from '~helpers/useConnection'

interface Props {
  versionId: StrongBibleVersionId
  expanded: boolean
  onAvailabilityChange: (isAvailable: boolean) => void
}

const isActiveDownload = (status?: string) =>
  status === 'queued' || status === 'downloading' || status === 'inserting'

const StrongIndexSelectorItem = ({ versionId, expanded, onAvailabilityChange }: Props) => {
  const { t } = useTranslation()
  const isConnected = useConnection()
  const bibleDownload = useDownloadItemStatus(createOfflineCopyId({ kind: 'bible', versionId }))
  const strongDownload = useDownloadItemStatus(
    createOfflineCopyId({ kind: 'strong-bible-index', versionId })
  )
  const resourceState = useOfflineResourceState(
    createOfflineCopyId({ kind: 'strong-bible-index', versionId })
  )
  const availability = resourceState?.availability as StrongBibleSidecarAvailability | undefined

  React.useEffect(() => {
    onAvailabilityChange(availability?.status === 'available')
  }, [availability?.status, onAvailabilityChange])

  const strongActiveDownload = isActiveDownload(strongDownload?.status) ? strongDownload : undefined
  const failedDownload = [bibleDownload, strongDownload].find(state => state?.status === 'failed')
  const isAvailable = availability?.status === 'available'
  const progress = strongActiveDownload ? getDownloadItemProgress(strongActiveDownload) : 0

  const handlePress = () => {
    if (isAvailable || strongActiveDownload) return
    if (!isConnected) return
    downloadManager.enqueue(
      createStrongSidecarDownloadPlan(versionId, availability?.status ?? 'missing')
    )
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
            accessibilityState={{
              disabled: !isConnected || Boolean(strongActiveDownload),
            }}
            activeOpacity={strongActiveDownload ? 1 : 0.7}
            disabled={!isConnected || Boolean(strongActiveDownload)}
            onPress={handlePress}
          >
            <Box width={48} minHeight={40} center>
              {strongActiveDownload?.status === 'queued' ? (
                <FeatherIcon name="clock" size={18} color="tertiary" />
              ) : strongActiveDownload ? (
                <Progress progress={Math.max(progress, 0.04)} size={22} thickness={2.5} />
              ) : (
                <FeatherIcon
                  name={failedDownload ? 'rotate-cw' : !isConnected ? 'wifi-off' : 'download-cloud'}
                  size={16}
                />
              )}
            </Box>
          </TouchableOpacity>
        )}
      </Box>
    </Box>
  )
}

export default StrongIndexSelectorItem
