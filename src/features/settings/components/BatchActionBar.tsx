import React from 'react'
import { TouchableOpacity } from 'react-native'
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
}

const BatchActionBar = ({
  selectedCount,
  hasDownloadable,
  hasDeletable,
  onDownload,
  onDelete,
}: BatchActionBarProps) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const insets = useSafeAreaInsets()

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
        <Text fontSize={14} bold flex>
          {t('downloads.selectedCount', { count: selectedCount })}
        </Text>

        {hasDownloadable && (
          <TouchableOpacity
            onPress={onDownload}
            style={{
              backgroundColor: theme.colors.primary,
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 8,
            }}
          >
            <Text fontSize={14} bold style={{ color: '#fff' }}>
              {t('downloads.download')}
            </Text>
          </TouchableOpacity>
        )}

        {hasDeletable && (
          <TouchableOpacity
            onPress={onDelete}
            style={{
              backgroundColor: theme.colors.quart,
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 8,
            }}
          >
            <Text fontSize={14} bold style={{ color: '#fff' }}>
              {t('Supprimer')}
            </Text>
          </TouchableOpacity>
        )}
      </Box>
    </Box>
  )
}

export default BatchActionBar
