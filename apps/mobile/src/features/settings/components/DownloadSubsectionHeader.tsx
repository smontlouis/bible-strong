import React from 'react'
import { TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'

import Box from '~common/ui/Box'
import Checkbox from '~common/ui/Checkbox'
import Text from '~common/ui/Text'

interface DownloadSubsectionHeaderProps {
  title: string
  allSelected: boolean
  onToggleSelectAll: () => void
}

const DownloadSubsectionHeader = ({
  title,
  allSelected,
  onToggleSelectAll,
}: DownloadSubsectionHeaderProps) => {
  const { t } = useTranslation()

  return (
    <TouchableOpacity
      accessibilityLabel={t('accessibility.selectAllInSection', { section: title })}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: allSelected }}
      onPress={onToggleSelectAll}
      activeOpacity={0.7}
    >
      <Box
        mt={12}
        minHeight={48}
        px={20}
        row
        alignItems="center"
        bg="lightGrey"
        borderTopWidth={1}
        borderBottomWidth={1}
        borderColor="border"
      >
        <Box width={28} height={28} mr={8} center>
          <Checkbox checked={allSelected} variant="icon" size={22} />
        </Box>
        <Text fontSize={16}>{title}</Text>
      </Box>
    </TouchableOpacity>
  )
}

export default DownloadSubsectionHeader
