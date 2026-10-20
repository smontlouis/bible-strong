import React from 'react'
import { TouchableOpacity } from 'react-native'
import { EaseView } from 'react-native-ease'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
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
    <Box className="border-continuous overflow-hidden min-h-[40px] flex-row items-center px-[24px]">
      <TouchableOpacity
        accessibilityLabel={title}
        accessibilityRole="button"
        accessibilityState={{ expanded: !isCollapsed }}
        onPress={onToggleCollapse}
        activeOpacity={0.7}
        style={{ flex: 1 }}
      >
        <Box className="overflow-hidden border-continuous flex-row items-center">
          <Text className="text-[13px] text-grey">{title}</Text>
          <EaseView
            animate={{ rotate: isCollapsed ? 0 : 90 }}
            transition={{
              type: 'timing',
              duration: 200,
              easing: [0.455, 0.03, 0.515, 0.955],
            }}
            style={{ marginLeft: 4, width: 16, height: 16 }}
          >
            <FeatherIcon name="chevron-right" size={16} color="grey" />
          </EaseView>
          <Box className="overflow-hidden border-continuous flex-[1]" />
          <Text className="text-[13px] text-grey">
            {downloadedCount}/{totalCount}
          </Text>
        </Box>
      </TouchableOpacity>
    </Box>
  )
}

export default DownloadSectionHeader
