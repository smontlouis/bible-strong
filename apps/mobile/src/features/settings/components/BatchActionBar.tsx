import React from 'react'
import { ActivityIndicator, TouchableOpacity } from 'react-native'
import { useTheme } from '@emotion/react'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'

interface BatchActionBarProps {
  selectedCount: number
  hasDownloadable: boolean
  hasDeletable: boolean
  onDownload: () => void
  onDelete: () => void
  downloadsDisabled?: boolean
  deletionProgress?: {
    completed: number
    total: number
  } | null
}

const BatchActionBar = ({
  selectedCount,
  hasDownloadable,
  hasDeletable,
  onDownload,
  onDelete,
  downloadsDisabled = false,
  deletionProgress = null,
}: BatchActionBarProps) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const isDeleting = deletionProgress !== null
  const progressPercent = deletionProgress
    ? Math.round((deletionProgress.completed / deletionProgress.total) * 100)
    : 0

  if (selectedCount === 0) return null

  return (
    <Box
      pos="absolute"
      l={0}
      r={0}
      b={0}
      bg="reverse"
      borderTopLeftRadius={16}
      borderTopRightRadius={16}
      px={20}
      pt={16}
      pb={insets.bottom > 0 ? insets.bottom : 16}
      lightShadow
    >
      <Box row alignItems="center" gap={12}>
        <Text fontSize={14} bold flex accessibilityLiveRegion={isDeleting ? 'polite' : undefined}>
          {deletionProgress
            ? t('downloads.deletingProgress', deletionProgress)
            : t('downloads.selectedCount', { count: selectedCount })}
        </Text>

        {hasDownloadable && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ disabled: downloadsDisabled || isDeleting }}
            disabled={downloadsDisabled || isDeleting}
            onPress={onDownload}
            style={{
              backgroundColor:
                downloadsDisabled || isDeleting ? theme.colors.tertiary : theme.colors.primary,
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 8,
            }}
          >
            <Text fontSize={14} bold style={{ color: '#fff' }}>
              {downloadsDisabled
                ? t('resource.action.connectionRequired')
                : t('downloads.download')}
            </Text>
          </TouchableOpacity>
        )}

        {hasDeletable && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ disabled: isDeleting, busy: isDeleting }}
            disabled={isDeleting}
            onPress={onDelete}
            style={{
              backgroundColor: isDeleting ? theme.colors.tertiary : theme.colors.quart,
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 8,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {isDeleting && <ActivityIndicator size="small" color="#fff" />}
            <Text fontSize={14} bold style={{ color: '#fff' }}>
              {isDeleting ? t('downloads.deleting') : t('Supprimer')}
            </Text>
          </TouchableOpacity>
        )}
      </Box>

      {deletionProgress !== null && (
        <Box mt={12} h={3} bg="border" borderRadius={2} overflow="hidden">
          <Box h={3} width={`${progressPercent}%`} bg="primary" />
        </Box>
      )}
    </Box>
  )
}

export default BatchActionBar
