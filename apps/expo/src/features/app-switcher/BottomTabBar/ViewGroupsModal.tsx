import { resolveThemeColor } from '~themes/colorValues'
import { useTheme as useStylingTheme, useTheme } from '~themes/ThemeProvider'
import { Sheet, type SheetRef } from '~common/sheet'
import distanceInWords from 'date-fns/formatDistance'
import { useAtomValue } from 'jotai/react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import Box, { HStack, TouchableBox, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { getDateLocale } from '~helpers/languageUtils'
import useLanguage from '~helpers/useLanguage'
import { activeGroupIdAtom, TabGroup, tabGroupsAtom } from '../../../state/tabs'
import { useAppSwitcherContext } from '../AppSwitcherContext'
import TabIcon from '../utils/getIconByTabType'
import { useMountTime } from '~helpers/useMountTime'
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
          className="overflow-hidden border-continuous bg-reverse items-center justify-center"
          key="remaining-tabs"
          style={{ width: cellSize, height: cellSize, borderRadius: cellBorderRadius }}
        >
          <Text className="text-default" style={{ fontSize: badgeFontSize || 16 }}>
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
        className="overflow-hidden border-continuous bg-reverse items-center justify-center"
        key={tab.id}
        style={{ width: cellSize, height: cellSize, borderRadius: cellBorderRadius }}
      >
        <TabIcon type={tab.type} size={iconSize} color={theme.colors.default} />
      </Box>
    )
  }

  return (
    <Box
      className="overflow-hidden border-continuous bg-grey"
      style={{
        padding: padding,
        width: gridSize,
        height: gridSize,
        borderRadius: gridBorderRadius,
      }}
    >
      <HStack className="overflow-hidden border-continuous flex-[1]" style={{ gap: gap }}>
        <VStack
          className="overflow-hidden border-continuous flex-[1] opacity-[0.7]"
          style={{ gap: gap }}
        >
          {renderCell(0)}
          {renderCell(2)}
        </VStack>
        <VStack
          className="overflow-hidden border-continuous flex-[1] opacity-[0.7]"
          style={{ gap: gap }}
        >
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
  const stylingTheme = useStylingTheme()

  const mountTime = useMountTime()
  const { t } = useTranslation()
  const theme = useTheme()
  const lang = useLanguage()

  const getCreatedText = () => {
    if (group.isDefault || group.createdAt === 0) {
      return t('tabs.defaultGroup')
    }
    const relativeDate = distanceInWords(group.createdAt, mountTime, {
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
      className="overflow-hidden border-continuous flex-row p-[16px] mb-[12px] rounded-[16px] bg-light-grey items-center"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${displayName}. ${getCreatedText()}`}
      accessibilityState={{ selected: isActive }}
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
      <VStack className="overflow-hidden border-continuous flex-[1] ml-[12px] gap-[4px]">
        <HStack className="overflow-hidden border-continuous items-center gap-[4px]">
          <Box
            className="overflow-hidden border-continuous w-[10px] h-[10px] rounded-[5px]"
            style={{ backgroundColor: resolveThemeColor(stylingTheme, group.color || 'grey') }}
          />
          <Text className="text-[16px] font-bold" numberOfLines={1} style={{ flex: 1 }}>
            {displayName}
          </Text>
        </HStack>
        <Text className="text-[13px] text-grey">{getCreatedText()}</Text>
      </VStack>
    </TouchableBox>
  )
}

interface ViewGroupsModalProps {
  sheetRef: React.RefObject<SheetRef | null>
  onClose?: () => void
}

const ViewGroupsModal = ({ sheetRef, onClose }: ViewGroupsModalProps) => {
  const groups = useAtomValue(tabGroupsAtom)
  const activeGroupId = useAtomValue(activeGroupIdAtom)
  const { groupPager } = useAppSwitcherContext()

  const handleClose = () => {
    sheetRef.current?.dismiss()
  }

  const handleSelectGroup = (groupId: string) => {
    const groupIndex = groups.findIndex(g => g.id === groupId)
    if (groupIndex !== -1) {
      groupPager.navigateToPage(groupIndex, groups.length)
    }
    handleClose()
  }

  return (
    <Sheet
      ref={sheetRef}
      onDismiss={onClose}
      // header={<SheetHeader title={t('tabs.viewMyGroups')} />}
    >
      <Box className="overflow-hidden border-continuous px-[20px] pt-[16px]">
        {groups.map(group => (
          <GroupCard
            key={group.id}
            group={group}
            isActive={group.id === activeGroupId}
            onPress={() => handleSelectGroup(group.id)}
          />
        ))}
      </Box>
    </Sheet>
  )
}

export default ViewGroupsModal
