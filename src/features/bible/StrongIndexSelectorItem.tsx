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
import { downloadCompletionSignalAtom } from '~state/downloadQueue'

interface Props {
  versionId: StrongBibleVersionId
}

const isActiveDownload = (status?: string) =>
  status === 'queued' || status === 'downloading' || status === 'inserting'

const StrongIndexSelectorItem = ({ versionId }: Props) => {
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
        if (!cancelled) setAvailability(nextAvailability)
      })
      .catch(() => {
        if (!cancelled) setAvailability(undefined)
      })
      .finally(() => {
        if (!cancelled) setIsChecking(false)
      })

    return () => {
      cancelled = true
    }
  }, [downloadCompletionSignal, versionId])

  const strongActiveDownload = isActiveDownload(strongDownload?.status) ? strongDownload : undefined
  const failedDownload = [bibleDownload, strongDownload].find(state => state?.status === 'failed')
  const isAvailable = availability?.status === 'available'
  const progress =
    strongActiveDownload?.status === 'inserting'
      ? 0.8 + strongActiveDownload.insertProgress * 0.2
      : (strongActiveDownload?.downloadProgress ?? 0)

  const handlePress = async () => {
    if (isChecking || isAvailable || strongActiveDownload) return

    let resolvedAvailability: StrongBibleSidecarAvailability | undefined = availability
    if (!resolvedAvailability) {
      setIsChecking(true)
      try {
        resolvedAvailability = await getStrongBibleSidecarAvailability(versionId)
        setAvailability(resolvedAvailability)
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

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={t('downloads.strongIndexName', { bible: versionId })}
      accessibilityState={{
        disabled: isChecking || isAvailable || Boolean(strongActiveDownload),
      }}
      activeOpacity={isAvailable || strongActiveDownload ? 1 : 0.7}
      disabled={isChecking || isAvailable || Boolean(strongActiveDownload)}
      onPress={handlePress}
    >
      <Box
        minHeight={64}
        pl={78}
        pr={16}
        py={10}
        justifyContent="center"
        borderBottomWidth={1}
        borderColor="border"
      >
        <Box
          pos="absolute"
          top={-14}
          left={52}
          width={20}
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
            <Text fontSize={10} color="tertiary" mt={2} numberOfLines={3}>
              {t('downloads.strongAttribution')}
            </Text>
          </Box>

          <Box width={48} minHeight={44} ml={8} center>
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
            ) : isAvailable ? (
              <FeatherIcon name="check" size={17} color="primary" />
            ) : (
              <FeatherIcon
                name={failedDownload ? 'rotate-cw' : 'download-cloud'}
                size={16}
                color="primary"
              />
            )}
          </Box>
        </Box>
      </Box>
    </TouchableOpacity>
  )
}

export default StrongIndexSelectorItem
