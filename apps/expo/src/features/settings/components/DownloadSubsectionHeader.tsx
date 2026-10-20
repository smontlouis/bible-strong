import React from 'react'
import { TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import Box from '~common/ui/Box'
import Checkbox from '~common/ui/Checkbox'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { EaseView } from 'react-native-ease'
import { DOWNLOAD_LIST_LAYOUT } from './downloadListLayout'
interface DownloadSubsectionHeaderProps {
  title: string
  isCollapsed: boolean
  downloadedCount: number
  totalCount: number
  allSelected: boolean
  onToggleSelectAll: () => void
  onToggleCollapse: () => void
}

const DownloadSubsectionHeader = ({
  title,
  isCollapsed,
  downloadedCount,
  totalCount,
  allSelected,
  onToggleSelectAll,
  onToggleCollapse,
}: DownloadSubsectionHeaderProps) => {
  const { t } = useTranslation()

  return (
    <Box
      className="border-continuous overflow-hidden min-h-[48px] flex-row items-center"
      style={{ paddingHorizontal: DOWNLOAD_LIST_LAYOUT.cardPaddingHorizontal }}
    >
      <TouchableOpacity
        accessibilityLabel={t('accessibility.selectAllInSection', { section: title })}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: allSelected }}
        onPress={onToggleSelectAll}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={{
          width: 28,
          height: 28,
          marginRight: 8,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Checkbox checked={allSelected} size={22} />
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityLabel={title}
        accessibilityRole="button"
        accessibilityState={{ expanded: !isCollapsed }}
        onPress={onToggleCollapse}
        activeOpacity={0.7}
        style={{ flex: 1 }}
      >
        <Box className="overflow-hidden border-continuous flex-row items-center">
          <Text className="text-[15px] font-bold">{title}</Text>
          <EaseView
            animate={{ rotate: isCollapsed ? 0 : 90 }}
            transition={{
              type: 'timing',
              duration: 200,
              easing: [0.455, 0.03, 0.515, 0.955],
            }}
            style={{ marginLeft: 6, width: 18, height: 18 }}
          >
            <FeatherIcon name="chevron-right" size={18} color="grey" />
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

export default DownloadSubsectionHeader
