import React from 'react'
import { ActivityIndicator, TouchableOpacity } from 'react-native'
import { useTheme } from '~themes/ThemeProvider'
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
      className="overflow-hidden border-continuous absolute left-[0px] right-[0px] bottom-[0px] bg-reverse rounded-tl-[16px] rounded-tr-[16px] px-[20px] pt-[16px]"
      style={{
        paddingBottom: insets.bottom > 0 ? insets.bottom : 16,
        shadowColor: 'rgb(89,131,240)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 7,
        elevation: 1,
        overflow: 'visible',
      }}
    >
      <Box className="overflow-hidden border-continuous flex-row items-center gap-[12px]">
        <Text
          className="text-[14px] font-bold flex-[1]"
          accessibilityLiveRegion={isDeleting ? 'polite' : undefined}
        >
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
            <Text className="text-[14px] font-bold" style={{ color: '#fff' }}>
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
            <Text className="text-[14px] font-bold" style={{ color: '#fff' }}>
              {isDeleting ? t('downloads.deleting') : t('Supprimer')}
            </Text>
          </TouchableOpacity>
        )}
      </Box>

      {deletionProgress !== null && (
        <Box className="border-continuous overflow-visible mt-[12px] h-[3px] bg-border rounded-[2px]">
          <Box
            className="overflow-hidden border-continuous h-[3px] bg-primary"
            style={{ width: `${progressPercent}%` }}
          />
        </Box>
      )}
    </Box>
  )
}

export default BatchActionBar
