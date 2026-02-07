import React from 'react'
import { TouchableOpacity } from 'react-native'
import Animated from 'react-native-reanimated'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Border from '~common/ui/Border'
import { FeatherIcon } from '~common/ui/Icon'

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
  return (
    <Box px={20} mt={20}>
      <TouchableOpacity onPress={onToggleCollapse} activeOpacity={0.7}>
        <Box row alignItems="center">
          {isSelectMode && (
            <TouchableOpacity
              onPress={onToggleSelectAll}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={{ marginRight: 8 }}
            >
              <FeatherIcon
                name={allSelected ? 'check-square' : 'square'}
                size={18}
                color={allSelected ? 'primary' : 'tertiary'}
              />
            </TouchableOpacity>
          )}
          <Animated.View
            style={{
              transform: [{ rotate: isCollapsed ? '0deg' : '90deg' }],
              transitionProperty: 'transform',
              transitionDuration: 200,
              marginRight: 8,
            }}
          >
            <FeatherIcon name="chevron-right" size={18} color="tertiary" />
          </Animated.View>
          <Text fontSize={16} bold flex>
            {title}
          </Text>
          <Text fontSize={13} color="tertiary">
            {downloadedCount}/{totalCount}
          </Text>
        </Box>
      </TouchableOpacity>
      <Border marginTop={10} />
    </Box>
  )
}

export default DownloadSectionHeader
