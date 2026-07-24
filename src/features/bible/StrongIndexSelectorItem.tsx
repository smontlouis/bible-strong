import { useTheme } from '@emotion/react'
import { useAtomValue } from 'jotai/react'
import React from 'react'
import { ActivityIndicator, TouchableOpacity } from 'react-native'
import Animated from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'

import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { downloadManager } from '~helpers/downloadManager'
import { createStrongSidecarDownloadPlan } from '~helpers/downloadItemFactory'
import type { StrongBibleVersionId } from '~helpers/strongBiblePublications'
import {
  getStrongBibleSidecarAvailability,
  type StrongBibleSidecarAvailability,
} from '~helpers/strongBibleSidecar'
import { useDownloadItemStatus } from '~helpers/useDownloadQueue'
import { downloadCompletionSignalAtom, getDownloadItemProgress } from '~state/downloadQueue'

interface Props {
  versionId: StrongBibleVersionId
  onAvailabilityChange: (isAvailable: boolean) => void
}

const isActiveDownload = (status?: string) =>
  status === 'queued' || status === 'downloading' || status === 'inserting'

const StrongIndexSelectorItem = ({ versionId, onAvailabilityChange }: Props) => {
  const theme = useTheme()
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

  if (isAvailable) return null

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={t('downloads.strongIndexName', { bible: versionId })}
      accessibilityState={{ disabled: isChecking || Boolean(strongActiveDownload) }}
      activeOpacity={strongActiveDownload ? 1 : 0.7}
      disabled={isChecking || Boolean(strongActiveDownload)}
      onPress={handlePress}
    >
      <Box
        minHeight={64}
        pl={56}
        pr={4}
        py={10}
        justifyContent="center"
        borderBottomWidth={1}
        borderColor="border"
      >
        <Box
          pos="absolute"
          top={-14}
          left={32}
          width={16}
          height={36}
          borderLeftWidth={2}
          borderBottomWidth={2}
          borderBottomLeftRadius={10}
          borderColor="border"
        />
        <Box row alignItems="center">
          <Box flex>
            <Text fontSize={14} bold numberOfLines={1}>
              {t('versionSelector.strongIndex')}
            </Text>
            <Text fontSize={10} color="tertiary" mt={2} numberOfLines={2}>
              {t('versionSelector.strongAttribution')}
            </Text>
          </Box>

          <Box width={48} minHeight={48} center>
            {isChecking ? (
              <ActivityIndicator size="small" />
            ) : strongActiveDownload?.status === 'queued' ? (
              <FeatherIcon name="clock" size={18} color="tertiary" />
            ) : strongActiveDownload ? (
              <Box width={36} height={4} borderRadius={2} bg="border" overflow="hidden">
                <Animated.View
                  style={{
                    height: 4,
                    borderRadius: 2,
                    backgroundColor:
                      strongActiveDownload.status === 'inserting'
                        ? theme.colors.success
                        : theme.colors.primary,
                    width: `${Math.round(progress * 100)}%`,
                    transitionProperty: 'width',
                    transitionDuration: 150,
                  }}
                />
              </Box>
            ) : (
              <FeatherIcon name={failedDownload ? 'rotate-cw' : 'download-cloud'} size={16} />
            )}
          </Box>
        </Box>
      </Box>
    </TouchableOpacity>
  )
}

export default StrongIndexSelectorItem
