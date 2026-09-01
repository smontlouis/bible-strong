import React from 'react'
import { useTranslation } from 'react-i18next'
import { TouchableOpacity } from 'react-native'
import { EaseView } from 'react-native-ease'

import Box from '~common/ui/Box'
import Checkbox from '~common/ui/Checkbox'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import { DOWNLOAD_LIST_LAYOUT } from './downloadListLayout'

interface DownloadSectionHeaderProps {
  title: string
  isCollapsed: boolean
  onToggleCollapse: () => void
  downloadedCount: number
  totalCount: number
  isSelectMode?: boolean
  allSelected?: boolean
  onToggleSelectAll?: () => void
}

const DownloadSectionHeader = ({
  title,
  isCollapsed,
  onToggleCollapse,
  downloadedCount,
  totalCount,
  isSelectMode,
  allSelected,
  onToggleSelectAll,
}: DownloadSectionHeaderProps) => {
  const { t } = useTranslation()

  return (
    <Box
      minHeight={52}
      px={DOWNLOAD_LIST_LAYOUT.sectionPaddingHorizontal}
      row
      alignItems="center"
      bg="lightGrey"
      borderTopWidth={1}
      borderBottomWidth={1}
      borderColor="border"
    >
      {isSelectMode && (
        <TouchableOpacity
          accessibilityLabel={t('accessibility.selectAllInSection', { section: title })}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: Boolean(allSelected) }}
          onPress={onToggleSelectAll}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{
            marginRight: 8,
            width: 28,
            height: 28,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Checkbox checked={Boolean(allSelected)} variant="icon" size={22} />
        </TouchableOpacity>
      )}
      <TouchableOpacity
        accessibilityLabel={title}
        accessibilityRole="button"
        accessibilityState={{ expanded: !isCollapsed }}
        onPress={onToggleCollapse}
        activeOpacity={0.7}
        style={{ flex: 1 }}
      >
        <Box row alignItems="center">
          <Text fontSize={16}>{title}</Text>
          <EaseView
            animate={{ rotate: isCollapsed ? 0 : 90 }}
            transition={{
              type: 'timing',
              duration: 200,
              easing: [0.455, 0.03, 0.515, 0.955],
            }}
            style={{ marginLeft: 6, width: 18, height: 18 }}
          >
            <FeatherIcon name="chevron-right" size={18} color="tertiary" />
          </EaseView>
          <Box flex />
          <Text fontSize={12} color="tertiary">
            {downloadedCount}/{totalCount}
          </Text>
        </Box>
      </TouchableOpacity>
    </Box>
  )
}

export default DownloadSectionHeader
