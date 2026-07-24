import { useAtomValue } from 'jotai/react'
import React from 'react'
import { ActivityIndicator, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'

import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Progress from '~common/ui/Progress'
import Text from '~common/ui/Text'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import { downloadManager } from '~helpers/downloadManager'
import { createInterlinearSidecarDownloadPlan } from '~helpers/downloadItemFactory'
import {
  getInterlinearSidecarAvailability,
  type InterlinearSidecarAvailability,
} from '~helpers/interlinearBibleSidecar'
import { useDownloadItemStatus } from '~helpers/useDownloadQueue'
import { downloadCompletionSignalAtom, getDownloadItemProgress } from '~state/downloadQueue'

interface Props {
  locale: ResourceLanguage
  expanded: boolean
  onAvailabilityChange: (isAvailable: boolean) => void
}

const isActiveDownload = (status?: string) =>
  status === 'queued' || status === 'downloading' || status === 'inserting'

const InterlinearIndexSelectorItem = ({ locale, expanded, onAvailabilityChange }: Props) => {
  const { t } = useTranslation()
  const downloadCompletionSignal = useAtomValue(downloadCompletionSignalAtom)
  const bibleDownload = useDownloadItemStatus('bible:BHG')
  const indexDownload = useDownloadItemStatus(`bible-interlinear:BHG:${locale}`)
  const [availability, setAvailability] = React.useState<InterlinearSidecarAvailability>()
  const [isChecking, setIsChecking] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    setIsChecking(true)

    getInterlinearSidecarAvailability(locale)
      .then(nextAvailability => {
        if (!cancelled) {
          setAvailability(nextAvailability)
          onAvailabilityChange(nextAvailability.status === 'available')
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAvailability(undefined)
          onAvailabilityChange(false)
        }
      })
      .finally(() => {
        if (!cancelled) setIsChecking(false)
      })

    return () => {
      cancelled = true
    }
  }, [downloadCompletionSignal, locale, onAvailabilityChange])

  const activeDownload = isActiveDownload(indexDownload?.status) ? indexDownload : undefined
  const failedDownload = [bibleDownload, indexDownload].find(state => state?.status === 'failed')
  const isAvailable = availability?.status === 'available'
  const progress = activeDownload ? getDownloadItemProgress(activeDownload) : 0

  const handlePress = async () => {
    if (isChecking || isAvailable || activeDownload) return

    let resolvedAvailability: InterlinearSidecarAvailability | undefined = availability
    if (!resolvedAvailability) {
      setIsChecking(true)
      resolvedAvailability = await getInterlinearSidecarAvailability(locale).catch(() => undefined)
      setIsChecking(false)
      if (!resolvedAvailability) return
      setAvailability(resolvedAvailability)
      onAvailabilityChange(resolvedAvailability.status === 'available')
    }

    if (!resolvedAvailability || resolvedAvailability.status === 'available') return
    downloadManager.enqueue(
      createInterlinearSidecarDownloadPlan(locale, resolvedAvailability.status)
    )
  }

  if (isAvailable || !expanded) return null

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
      <Box row alignItems="center">
        <Box disabled flex>
          <Text fontSize={14} numberOfLines={1}>
            {t('versionSelector.interlinearIndex')}
          </Text>
          <Text fontSize={10} color="tertiary" mt={2} numberOfLines={2}>
            {t('versionSelector.interlinearAttribution')}
          </Text>
        </Box>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('downloads.interlinearIndexName')}
          accessibilityState={{ disabled: isChecking || Boolean(activeDownload) }}
          activeOpacity={activeDownload ? 1 : 0.7}
          disabled={isChecking || Boolean(activeDownload)}
          onPress={handlePress}
        >
          <Box width={48} minHeight={40} center>
            {isChecking ? (
              <ActivityIndicator size="small" />
            ) : activeDownload?.status === 'queued' ? (
              <FeatherIcon name="clock" size={18} color="tertiary" />
            ) : activeDownload ? (
              <Progress progress={Math.max(progress, 0.04)} size={22} thickness={2.5} />
            ) : (
              <FeatherIcon name={failedDownload ? 'rotate-cw' : 'download-cloud'} size={16} />
            )}
          </Box>
        </TouchableOpacity>
      </Box>
    </Box>
  )
}

export default InterlinearIndexSelectorItem
