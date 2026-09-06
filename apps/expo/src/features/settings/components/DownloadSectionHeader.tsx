import React from 'react'
import { TouchableOpacity } from 'react-native'
import { EaseView } from 'react-native-ease'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import { DOWNLOAD_LIST_LAYOUT } from './downloadListLayout'
interface DownloadSectionHeaderProps {
  title: string
  isCollapsed: boolean
  onToggleCollapse: () => void
  downloadedCount: number
  totalCount: number
}

const DownloadSectionHeader = ({
  title,
  isCollapsed,
  onToggleCollapse,
  downloadedCount,
  totalCount,
}: DownloadSectionHeaderProps) => {
  return (
    <Box
      className="border-continuous overflow-hidden min-h-[52px] flex-row items-center bg-light-grey border-t-[1px] border-b-[1px] border-border"
      style={{ paddingHorizontal: DOWNLOAD_LIST_LAYOUT.sectionPaddingHorizontal }}
    >
      <TouchableOpacity
        accessibilityLabel={title}
        accessibilityRole="button"
        accessibilityState={{ expanded: !isCollapsed }}
        onPress={onToggleCollapse}
        activeOpacity={0.7}
        style={{ flex: 1 }}
      >
        <Box className="overflow-hidden border-continuous flex-row items-center">
          <Text className="text-[16px]">{title}</Text>
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
          <Box className="overflow-hidden border-continuous flex-[1]" />
          <Text className="text-[12px] text-tertiary">
            {downloadedCount}/{totalCount}
          </Text>
        </Box>
      </TouchableOpacity>
    </Box>
  )
}

export default DownloadSectionHeader
