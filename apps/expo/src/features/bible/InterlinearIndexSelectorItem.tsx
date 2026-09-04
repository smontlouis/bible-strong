import React from 'react'
import { TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'

import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Progress from '~common/ui/Progress'
import Text from '~common/ui/Text'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import { downloadManager } from '~helpers/downloadManager'
import { createInterlinearSidecarDownloadPlan } from '~helpers/downloadItemFactory'
import type { InterlinearSidecarAvailability } from '~helpers/interlinearBibleSidecar'
import { useDownloadItemStatus } from '~helpers/useDownloadQueue'
import { createOfflineCopyId } from '~helpers/offlineCopyId'
import { getDownloadItemProgress } from '~state/downloadQueue'
import { useOfflineResourceState } from '~features/resources/useOfflineResourceRegistry'
import useConnection from '~helpers/useConnection'

interface Props {
  locale: ResourceLanguage
  expanded: boolean
  onAvailabilityChange: (isAvailable: boolean) => void
}

const isActiveDownload = (status?: string) =>
  status === 'queued' || status === 'downloading' || status === 'inserting'

const InterlinearIndexSelectorItem = ({ locale, expanded, onAvailabilityChange }: Props) => {
  const { t } = useTranslation()
  const isConnected = useConnection()
  const bibleDownload = useDownloadItemStatus(
    createOfflineCopyId({ kind: 'bible', versionId: 'BHG' })
  )
  const indexDownload = useDownloadItemStatus(
    createOfflineCopyId({ kind: 'interlinear-index', versionId: 'BHG', language: locale })
  )
  const resourceState = useOfflineResourceState(
    createOfflineCopyId({ kind: 'interlinear-index', versionId: 'BHG', language: locale })
  )
  const availability = resourceState?.availability as InterlinearSidecarAvailability | undefined

  React.useEffect(() => {
    onAvailabilityChange(availability?.status === 'available')
  }, [availability?.status, onAvailabilityChange])

  const activeDownload = isActiveDownload(indexDownload?.status) ? indexDownload : undefined
  const failedDownload = [bibleDownload, indexDownload].find(state => state?.status === 'failed')
  const isAvailable = availability?.status === 'available'
  const progress = activeDownload ? getDownloadItemProgress(activeDownload) : 0

  const handlePress = () => {
    if (isAvailable || activeDownload) return
    if (!isConnected) return
    downloadManager.enqueue(
      createInterlinearSidecarDownloadPlan(locale, availability?.status ?? 'missing')
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
            {`${t('versionSelector.interlinearIndex')} · ${t(`versionCatalog.language.${locale}`)}`}
          </Text>
          <Text fontSize={10} color="tertiary" mt={2} numberOfLines={2}>
            {t('versionSelector.interlinearAttribution')}
          </Text>
        </Box>

        {isAvailable ? (
          <Box width={48} minHeight={40} center>
            <FeatherIcon name="check" size={18} color="primary" />
          </Box>
        ) : (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('downloads.interlinearIndexName')}
            accessibilityState={{
              disabled: !isConnected || Boolean(activeDownload),
            }}
            activeOpacity={activeDownload ? 1 : 0.7}
            disabled={!isConnected || Boolean(activeDownload)}
            onPress={handlePress}
          >
            <Box width={48} minHeight={40} center>
              {activeDownload?.status === 'queued' ? (
                <FeatherIcon name="clock" size={18} color="tertiary" />
              ) : activeDownload ? (
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

export default InterlinearIndexSelectorItem
