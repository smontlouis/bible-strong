import React from 'react'
import { TouchableOpacity } from 'react-native'
import { useTheme } from '@emotion/react'
import { useTranslation } from 'react-i18next'
import Animated from 'react-native-reanimated'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import { useDownloadItemStatus } from '~helpers/useDownloadQueue'
import type { DownloadItemState } from '~state/downloadQueue'
import { downloadManager } from '~helpers/downloadManager'

interface DownloadableItemProps {
  itemId: string
  name: string
  subtitle?: string
  estimatedSize?: number
  isSelectMode?: boolean
  isSelected?: boolean
  onToggleSelect?: () => void
  onDownload?: () => void
  onDelete?: () => void
  onRedownload?: () => void
  onUpdate?: () => void
  isDownloaded?: boolean
  isDefault?: boolean
  needsUpdate?: boolean
}

const formatSize = (
  bytes: number,
  t: (key: string, opts?: Record<string, unknown>) => string
): string => {
  if (bytes >= 1_000_000) return t('downloads.size.mb', { value: Math.round(bytes / 1_000_000) })
  if (bytes >= 1_000) return t('downloads.size.kb', { value: Math.round(bytes / 1_000) })
  return t('downloads.size.b', { value: bytes })
}

const DownloadableItem = ({
  itemId,
  name,
  subtitle,
  estimatedSize,
  isSelectMode,
  isSelected,
  onToggleSelect,
  onDownload,
  onDelete,
  onRedownload,
  onUpdate,
  isDownloaded,
  isDefault,
  needsUpdate,
}: DownloadableItemProps) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const queueState = useDownloadItemStatus(itemId)

  // Determine visual state
  const visualState = getVisualState({
    queueState,
    isSelectMode,
    isSelected,
    isDownloaded,
    needsUpdate,
  })

  const handlePress = () => {
    if (isSelectMode) {
      onToggleSelect?.()
      return
    }

    switch (visualState) {
      case 'not-downloaded':
        onDownload?.()
        break
      case 'downloaded':
        // No action on press for downloaded items
        break
      case 'needs-update':
        onUpdate?.()
        break
      case 'failed':
        downloadManager.retry(itemId)
        break
    }
  }

  const handleCancel = () => {
    downloadManager.cancel(itemId)
  }

  const isActive =
    visualState === 'downloading' || visualState === 'inserting' || visualState === 'queued'

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={isActive ? 1 : 0.7}>
      <Animated.View
        style={{
          paddingRight: 20,
          paddingLeft: 45,
          paddingVertical: 12,
          opacity: visualState === 'not-downloaded' ? 0.5 : 1,
          backgroundColor: visualState === 'selected' ? theme.colors.lightPrimary : 'transparent',
          borderLeftWidth: visualState === 'needs-update' ? 4 : 0,
          borderLeftColor: visualState === 'needs-update' ? theme.colors.success : 'transparent',
          transitionProperty: ['opacity', 'backgroundColor'],
          transitionDuration: 200,
        }}
      >
        <Box row flex alignItems="center">
          {/* Checkbox in select mode */}
          {isSelectMode && (
            <Animated.View
              style={{
                width: 28,
                marginRight: 12,
                transitionProperty: ['width', 'opacity'],
                transitionDuration: 200,
              }}
            >
              <FeatherIcon
                name={isSelected ? 'check-square' : 'square'}
                size={20}
                color={isSelected ? 'primary' : 'tertiary'}
              />
            </Animated.View>
          )}

          {/* Content */}
          <Box flex>
            <Text fontSize={15} bold numberOfLines={1}>
              {name}
            </Text>

            {/* Subtitle / status text */}
            {visualState === 'queued' && (
              <Text fontSize={12} color="tertiary" mt={2}>
                {t('downloads.queue')}
              </Text>
            )}
            {visualState === 'failed' && queueState?.error && (
              <Text fontSize={12} color="quart" mt={2} numberOfLines={1}>
                {queueState.error}
              </Text>
            )}
            {subtitle && visualState !== 'queued' && visualState !== 'failed' && (
              <Text fontSize={12} color="tertiary" mt={2} numberOfLines={2}>
                {subtitle}
              </Text>
            )}

            {/* Progress bar */}
            {(visualState === 'downloading' || visualState === 'inserting') && queueState && (
              <Box mt={6} height={4} borderRadius={2} bg="border" overflow="hidden">
                <Animated.View
                  style={{
                    height: 4,
                    borderRadius: 2,
                    backgroundColor:
                      visualState === 'inserting' ? theme.colors.success : theme.colors.primary,
                    width: `${Math.round(
                      (visualState === 'inserting'
                        ? queueState.insertProgress
                        : queueState.downloadProgress) * 100
                    )}%` as any,
                    transitionProperty: 'width',
                    transitionDuration: 150,
                  }}
                />
              </Box>
            )}
          </Box>

          {/* Right side action */}
          <Box ml={12} alignItems="flex-end" justifyContent="center">
            {visualState === 'not-downloaded' && !isSelectMode && (
              <Box alignItems="flex-end" mr={5}>
                <FeatherIcon name="download-cloud" size={16} color="primary" />
                {estimatedSize != null && estimatedSize > 0 && (
                  <Text fontSize={10} color="tertiary" mt={2}>
                    {formatSize(estimatedSize, t)}
                  </Text>
                )}
              </Box>
            )}

            {visualState === 'selected' && estimatedSize != null && estimatedSize > 0 && (
              <Text fontSize={10} color="tertiary">
                {formatSize(estimatedSize, t)}
              </Text>
            )}

            {visualState === 'queued' && <FeatherIcon name="clock" size={18} color="tertiary" />}

            {visualState === 'downloading' && queueState && (
              <Box row alignItems="center" gap={8}>
                <Text fontSize={12} color="tertiary">
                  {Math.round(queueState.downloadProgress * 100)}%
                </Text>
                <TouchableOpacity
                  onPress={handleCancel}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <FeatherIcon name="x" size={18} color="quart" />
                </TouchableOpacity>
              </Box>
            )}

            {visualState === 'inserting' && (
              <Text fontSize={12} color="success">
                {t('downloads.inserting')}
              </Text>
            )}

            {visualState === 'downloaded' && !isSelectMode && isDefault && (
              <TouchableOpacity
                onPress={onRedownload}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={{ padding: 4 }}
              >
                <FeatherIcon name="refresh-cw" size={16} color="tertiary" />
              </TouchableOpacity>
            )}

            {visualState === 'downloaded' && !isSelectMode && !isDefault && (
              <TouchableOpacity
                onPress={onDelete}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={{ padding: 4 }}
              >
                <FeatherIcon name="trash-2" size={16} color="quart" />
              </TouchableOpacity>
            )}

            {visualState === 'needs-update' && !isSelectMode && (
              <TouchableOpacity
                onPress={onUpdate}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={{ padding: 4 }}
              >
                <FeatherIcon name="refresh-cw" size={18} color="success" />
              </TouchableOpacity>
            )}

            {visualState === 'failed' && !isSelectMode && (
              <Box row gap={8} alignItems="center">
                <TouchableOpacity
                  onPress={() => downloadManager.retry(itemId)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text fontSize={12} color="primary" bold>
                    {t('downloads.retry')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleCancel}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <FeatherIcon name="x" size={16} color="quart" />
                </TouchableOpacity>
              </Box>
            )}
          </Box>
        </Box>
      </Animated.View>
    </TouchableOpacity>
  )
}

type VisualState =
  | 'not-downloaded'
  | 'selected'
  | 'queued'
  | 'downloading'
  | 'inserting'
  | 'downloaded'
  | 'needs-update'
  | 'failed'

function getVisualState({
  queueState,
  isSelectMode,
  isSelected,
  isDownloaded,
  needsUpdate,
}: {
  queueState?: DownloadItemState
  isSelectMode?: boolean
  isSelected?: boolean
  isDownloaded?: boolean
  needsUpdate?: boolean
}): VisualState {
  // Queue states take priority
  if (queueState) {
    switch (queueState.status) {
      case 'queued':
        return 'queued'
      case 'downloading':
        return 'downloading'
      case 'inserting':
        return 'inserting'
      case 'failed':
        return 'failed'
      case 'completed':
        // Completed items show as downloaded
        break
      case 'cancelled':
        // Cancelled items fall through to base state
        break
    }
  }

  if (isSelectMode && isSelected) return 'selected'
  if (needsUpdate) return 'needs-update'
  if (isDownloaded || queueState?.status === 'completed') return 'downloaded'
  return 'not-downloaded'
}

export default DownloadableItem
