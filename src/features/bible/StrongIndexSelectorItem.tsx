import { useAtomValue } from 'jotai/react'
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
  const [availability, setAvailability] = React.useState<StrongBibleSidecarAvailability>()
  const [isChecking, setIsChecking] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    setIsChecking(true)

    getStrongBibleSidecarAvailability(versionId)
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
  }, [downloadCompletionSignal, onAvailabilityChange, versionId])

  const strongActiveDownload = isActiveDownload(strongDownload?.status) ? strongDownload : undefined
  const failedDownload = [bibleDownload, strongDownload].find(state => state?.status === 'failed')
  const isAvailable = availability?.status === 'available'
  const progress = strongActiveDownload ? getDownloadItemProgress(strongActiveDownload) : 0

  const handlePress = async () => {
    if (isChecking || isAvailable || strongActiveDownload) return

    let resolvedAvailability: StrongBibleSidecarAvailability | undefined = availability
    if (!resolvedAvailability) {
      setIsChecking(true)
      try {
        resolvedAvailability = await getStrongBibleSidecarAvailability(versionId)
        setAvailability(resolvedAvailability)
        onAvailabilityChange(resolvedAvailability.status === 'available')
      } catch {
        return
      } finally {
        setIsChecking(false)
      }
    }

    if (resolvedAvailability) {
      downloadManager.enqueue(
        createStrongSidecarDownloadPlan(versionId, resolvedAvailability.status)
      )
    }
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
            {t('versionSelector.strongIndex')}
          </Text>
          <Text fontSize={10} color="tertiary" mt={2} numberOfLines={2}>
            {t(getStrongBibleAttributionKey(versionId))}
          </Text>
        </Box>

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
      </Box>
    </Box>
  )
}

export default StrongIndexSelectorItem
