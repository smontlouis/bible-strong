import { useTheme } from '@emotion/react'
import { BottomSheetModal } from '@gorhom/bottom-sheet'
import distanceInWords from 'date-fns/formatDistance'
import { useAtomValue } from 'jotai/react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Modal from '~common/Modal'
import ModalHeader from '~common/ModalHeader'
import Box, { HStack, TouchableBox, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { getDateLocale } from '~helpers/languageUtils'
import useLanguage from '~helpers/useLanguage'
import { activeGroupIdAtom, TabGroup, tabGroupsAtom } from '../../../state/tabs'
import { useAppSwitcherContext } from '../AppSwitcherProvider'
import TabIcon from '../utils/getIconByTabType'

interface TabPreviewGridProps {
  group: TabGroup
  size?: number
}

const TabPreviewGrid = ({ group, size: gridSize = 50 }: TabPreviewGridProps) => {
  const theme = useTheme()
  const tabs = group.tabs
  const displayedTabs = tabs.slice(0, 4)
  const remainingCount = Math.max(0, tabs.length - 3)
  const showBadge = tabs.length > 4

  // Calculate all dimensions based on gridSize
  const padding = Math.round(gridSize * 0.08)
  const gap = Math.round(gridSize * 0.03)
  const cellSize = Math.round((gridSize - 2 * padding - gap) / 2)
  const iconSize = Math.round(cellSize * 0.6)
  const gridBorderRadius = Math.round(gridSize * 0.2)
  const cellBorderRadius = Math.round(cellSize * 0.25)
  const badgeFontSize = Math.round(cellSize * 0.4)

  const renderCell = (index: number) => {
    const tab = displayedTabs[index]
    const isLastCell = index === 3
    const showCount = isLastCell && showBadge

    if (showCount) {
      return (
        <Box
          key={`badge-${index}`}
          width={cellSize}
          height={cellSize}
          borderRadius={cellBorderRadius}
          bg="reverse"
          center
        >
          <Text fontSize={badgeFontSize} color="default">
            +{remainingCount}
          </Text>
        </Box>
      )
    }

    if (!tab) {
      return null
    }

    return (
      <Box
        key={tab.id}
        width={cellSize}
        height={cellSize}
        borderRadius={cellBorderRadius}
        bg="reverse"
        center
      >
        <TabIcon type={tab.type} size={iconSize} color={theme.colors.default} />
      </Box>
    )
  }

  return (
    <Box
      width={gridSize}
      height={gridSize}
      borderRadius={gridBorderRadius}
      bg="grey"
      padding={padding}
    >
      <HStack flex={1} gap={gap}>
        <VStack flex={1} gap={gap} opacity={0.7}>
          {renderCell(0)}
          {renderCell(2)}
        </VStack>
        <VStack flex={1} gap={gap} opacity={0.7}>
          {renderCell(1)}
          {renderCell(3)}
        </VStack>
      </HStack>
    </Box>
  )
}

interface GroupCardProps {
  group: TabGroup
  isActive: boolean
  onPress: () => void
}

const GroupCard = ({ group, isActive, onPress }: GroupCardProps) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const lang = useLanguage()

  const getCreatedText = () => {
    if (group.isDefault || group.createdAt === 0) {
      return t('tabs.defaultGroup')
    }
    const relativeDate = distanceInWords(group.createdAt, Date.now(), {
      locale: getDateLocale(lang),
      addSuffix: true,
    })
    return t('tabs.createdAgo', { date: relativeDate })
  }

  const tabCount = group.tabs.length
  const displayName = group.isDefault
    ? `${tabCount} ${t('tabs.tab', { count: tabCount })}`
    : group.name

  return (
    <TouchableBox
      row
      padding={16}
      marginBottom={12}
      borderRadius={16}
      bg="lightGrey"
      alignItems="center"
      onPress={onPress}
      style={
        isActive
          ? {
              borderWidth: 2,
              borderColor: group.color || theme.colors.primary,
            }
          : undefined
      }
    >
      <TabPreviewGrid group={group} />
      <VStack flex={1} marginLeft={12} gap={4}>
        <HStack alignItems="center" gap={4}>
          <Box width={10} height={10} borderRadius={5} bg={group.color || 'grey'} />
          <Text fontSize={16} bold numberOfLines={1} style={{ flex: 1 }}>
            {displayName}
          </Text>
        </HStack>
        <Text fontSize={13} color="grey">
          {getCreatedText()}
        </Text>
      </VStack>
    </TouchableBox>
  )
}

interface ViewGroupsModalProps {
  bottomSheetRef: React.RefObject<BottomSheetModal | null>
  onClose?: () => void
}

const ViewGroupsModal = ({ bottomSheetRef, onClose }: ViewGroupsModalProps) => {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const groups = useAtomValue(tabGroupsAtom)
  const activeGroupId = useAtomValue(activeGroupIdAtom)
  const { groupPager } = useAppSwitcherContext()

  const handleClose = () => {
    bottomSheetRef.current?.dismiss()
    onClose?.()
  }

  const handleSelectGroup = (groupId: string) => {
    const groupIndex = groups.findIndex(g => g.id === groupId)
    if (groupIndex !== -1) {
      groupPager.navigateToPage(groupIndex, groups.length)
    }
    handleClose()
  }

  return (
    <Modal.Body
      ref={bottomSheetRef}
      onModalClose={handleClose}
      topInset={insets.top}
      enableDynamicSizing
      // headerComponent={<ModalHeader title={t('tabs.viewMyGroups')} />}
    >
      <Box paddingHorizontal={20} paddingTop={16}>
        {groups.map(group => (
          <GroupCard
            key={group.id}
            group={group}
            isActive={group.id === activeGroupId}
            onPress={() => handleSelectGroup(group.id)}
          />
        ))}
      </Box>
    </Modal.Body>
  )
}

export default ViewGroupsModal
