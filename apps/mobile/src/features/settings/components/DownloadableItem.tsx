import React from 'react'
import { TouchableOpacity } from 'react-native'
import { useTheme } from '@emotion/react'
import { useTranslation } from 'react-i18next'
import Animated from 'react-native-reanimated'

import Box from '~common/ui/Box'
import Checkbox from '~common/ui/Checkbox'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import { useDownloadItemStatus } from '~helpers/useDownloadQueue'
import type { DownloadItemState } from '~state/downloadQueue'
import { downloadManager } from '~helpers/downloadManager'
import { useResourcePublicationStatus } from '~helpers/useResourcePublicationStatus'

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
  isInvalid?: boolean
  relatedResources?: { resourceId: string }[]
  variant?: 'standard' | 'dependency'
  onlineAccessStatus?: 'remotely-readable' | 'temporarily-unavailable' | 'unsupported'
  downloadsDisabled?: boolean
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
  isInvalid,
  relatedResources,
  variant = 'standard',
  onlineAccessStatus = 'unsupported',
  downloadsDisabled = false,
}: DownloadableItemProps) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const queueState = useDownloadItemStatus(itemId)
  const publication = useResourcePublicationStatus({
    resourceId: itemId,
    isInstalled: Boolean(isDownloaded),
    relatedResources,
  })
  const effectiveNeedsUpdate = needsUpdate || publication.status === 'update-available'
  const isDependency = variant === 'dependency'

  // Determine visual state
  const visualState = getVisualState({
    queueState,
    isSelectMode,
    isSelected,
    isDownloaded,
    isInvalid,
    needsUpdate: effectiveNeedsUpdate,
  })

  const handlePress = () => {
    if (isSelectMode) {
      onToggleSelect?.()
      return
    }

    switch (visualState) {
      case 'not-downloaded':
        if (downloadsDisabled) break
        onDownload?.()
        break
      case 'downloaded':
        // No action on press for downloaded items
        break
      case 'needs-update':
        if (downloadsDisabled) break
        onUpdate?.()
        break
      case 'invalid':
        if (downloadsDisabled) break
        onRedownload?.()
        break
      case 'failed':
        if (downloadsDisabled) break
        downloadManager.retry(itemId)
        break
    }
  }

  const handleCancel = () => {
    downloadManager.cancel(itemId)
  }

  const isActive =
    visualState === 'downloading' || visualState === 'inserting' || visualState === 'queued'
  const isMainInteractive =
    Boolean(isSelectMode) ||
    ['not-downloaded', 'needs-update', 'invalid', 'failed'].includes(visualState)
  const isMainDisabled =
    downloadsDisabled &&
    ['not-downloaded', 'needs-update', 'invalid', 'failed'].includes(visualState)

  return (
    <Animated.View
      style={{
        paddingRight: 20,
        paddingLeft: isDependency ? 78 : 45,
        paddingVertical: isDependency ? 10 : 12,
        opacity: visualState === 'not-downloaded' ? 0.5 : 1,
        backgroundColor: visualState === 'selected' ? theme.colors.lightPrimary : 'transparent',
        borderLeftWidth: ['needs-update', 'invalid'].includes(visualState) ? 4 : 0,
        borderLeftColor:
          visualState === 'needs-update'
            ? theme.colors.success
            : visualState === 'invalid'
              ? theme.colors.quart
              : 'transparent',
        overflow: 'visible',
        transitionProperty: ['opacity', 'backgroundColor'],
        transitionDuration: 200,
      }}
    >
      {isDependency ? (
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
      ) : null}
      <Box row flex alignItems="center">
        <TouchableOpacity
          accessibilityLabel={name}
          accessibilityRole={isSelectMode ? 'checkbox' : isMainInteractive ? 'button' : 'text'}
          accessibilityState={{
            checked: isSelectMode ? Boolean(isSelected) : undefined,
            busy: isActive,
            disabled: isMainDisabled,
          }}
          accessibilityValue={
            queueState && (visualState === 'downloading' || visualState === 'inserting')
              ? {
                  min: 0,
                  max: 100,
                  now: Math.round(
                    (visualState === 'inserting'
                      ? queueState.insertProgress
                      : queueState.downloadProgress) * 100
                  ),
                }
              : undefined
          }
          disabled={isMainDisabled}
          onPress={isMainInteractive ? handlePress : undefined}
          activeOpacity={isActive ? 1 : 0.7}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
        >
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
              <Checkbox checked={Boolean(isSelected)} variant="icon" size={20} />
            </Animated.View>
          )}

          {/* Content */}
          <Box flex>
            <Text fontSize={isDependency ? 14 : 15} bold numberOfLines={1}>
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
            {visualState === 'invalid' && (
              <Text fontSize={12} color="quart" mt={2}>
                {t('downloads.invalidCopy')}
              </Text>
            )}
            {subtitle && visualState !== 'queued' && visualState !== 'failed' && (
              <Text fontSize={12} color="tertiary" mt={2} numberOfLines={isDependency ? 3 : 2}>
                {subtitle}
              </Text>
            )}
            {visualState !== 'queued' && visualState !== 'failed' && visualState !== 'invalid' && (
              <Text fontSize={11} color="tertiary" mt={3}>
                {t(
                  onlineAccessStatus === 'remotely-readable'
                    ? 'resource.status.onlineAvailable'
                    : onlineAccessStatus === 'temporarily-unavailable'
                      ? 'resource.status.onlineTemporary'
                      : 'resource.status.onlineUnsupported'
                )}
                {' · '}
                {t(
                  isDownloaded
                    ? 'resource.status.offlineInstalled'
                    : 'resource.status.offlineNotInstalled'
                )}
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
                    )}%`,
                    transitionProperty: 'width',
                    transitionDuration: 150,
                  }}
                />
              </Box>
            )}
          </Box>
        </TouchableOpacity>

        {/* Right side action */}
        <Box ml={12} alignItems="flex-end" justifyContent="center">
          {visualState === 'not-downloaded' && !isSelectMode && (
            <TouchableOpacity
              accessibilityLabel={t('accessibility.downloadItem', { item: name })}
              accessibilityRole="button"
              accessibilityState={{ disabled: downloadsDisabled }}
              disabled={downloadsDisabled}
              onPress={onDownload}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={{ alignItems: 'flex-end', marginRight: 5, padding: 4 }}
            >
              <FeatherIcon
                name={downloadsDisabled ? 'wifi-off' : 'download-cloud'}
                size={16}
                color={downloadsDisabled ? 'tertiary' : 'primary'}
              />
              {estimatedSize != null && estimatedSize > 0 && (
                <Text fontSize={10} color="tertiary" mt={2}>
                  {formatSize(estimatedSize, t)}
                </Text>
              )}
            </TouchableOpacity>
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
                accessibilityLabel={t('accessibility.cancelDownload', { item: name })}
                accessibilityRole="button"
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
              accessibilityLabel={t('accessibility.redownload', { item: name })}
              accessibilityRole="button"
              accessibilityState={{ disabled: downloadsDisabled }}
              disabled={downloadsDisabled}
              onPress={onRedownload}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={{ padding: 4 }}
            >
              <FeatherIcon
                name={downloadsDisabled ? 'wifi-off' : 'refresh-cw'}
                size={16}
                color="tertiary"
              />
            </TouchableOpacity>
          )}

          {visualState === 'downloaded' && !isSelectMode && !isDefault && (
            <TouchableOpacity
              accessibilityLabel={t('accessibility.deleteDownload', { item: name })}
              accessibilityRole="button"
              onPress={onDelete}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={{ padding: 4 }}
            >
              <FeatherIcon name="trash-2" size={16} color="quart" />
            </TouchableOpacity>
          )}

          {visualState === 'needs-update' && !isSelectMode && (
            <TouchableOpacity
              accessibilityLabel={t('accessibility.updateDownload', { item: name })}
              accessibilityRole="button"
              accessibilityState={{ disabled: downloadsDisabled }}
              disabled={downloadsDisabled}
              onPress={onUpdate}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={{ padding: 4 }}
            >
              <FeatherIcon
                name={downloadsDisabled ? 'wifi-off' : 'refresh-cw'}
                size={18}
                color={downloadsDisabled ? 'tertiary' : 'success'}
              />
            </TouchableOpacity>
          )}

          {visualState === 'invalid' && !isSelectMode && (
            <TouchableOpacity
              accessibilityLabel={t('accessibility.redownload', { item: name })}
              accessibilityRole="button"
              accessibilityState={{ disabled: downloadsDisabled }}
              disabled={downloadsDisabled}
              onPress={onRedownload}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={{ padding: 4 }}
            >
              <FeatherIcon
                name={downloadsDisabled ? 'wifi-off' : 'refresh-cw'}
                size={18}
                color={downloadsDisabled ? 'tertiary' : 'quart'}
              />
            </TouchableOpacity>
          )}

          {visualState === 'failed' && !isSelectMode && (
            <Box row gap={8} alignItems="center">
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ disabled: downloadsDisabled }}
                disabled={downloadsDisabled}
                onPress={() => downloadManager.retry(itemId)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text fontSize={12} color={downloadsDisabled ? 'tertiary' : 'primary'} bold>
                  {downloadsDisabled
                    ? t('resource.action.connectionRequired')
                    : t('downloads.retry')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityLabel={t('accessibility.cancelDownload', { item: name })}
                accessibilityRole="button"
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
  | 'invalid'
  | 'failed'

function getVisualState({
  queueState,
  isSelectMode,
  isSelected,
  isDownloaded,
  needsUpdate,
  isInvalid,
}: {
  queueState?: DownloadItemState
  isSelectMode?: boolean
  isSelected?: boolean
  isDownloaded?: boolean
  needsUpdate?: boolean
  isInvalid?: boolean
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
  if (isInvalid) return 'invalid'
  if (needsUpdate) return 'needs-update'
  if (isDownloaded || queueState?.status === 'completed') return 'downloaded'
  return 'not-downloaded'
}

export default DownloadableItem
