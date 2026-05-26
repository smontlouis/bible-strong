import React from 'react'
import { TouchableOpacity } from 'react-native'
import { EaseView } from 'react-native-ease'

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
          <EaseView
            animate={{ rotate: isCollapsed ? 0 : 90 }}
            transition={{
              type: 'timing',
              duration: 200,
              easing: [0.455, 0.03, 0.515, 0.955],
            }}
            style={{
              marginRight: 8,
              width: 18,
              height: 18,
            }}
          >
            <FeatherIcon name="chevron-right" size={18} color="tertiary" />
          </EaseView>
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
