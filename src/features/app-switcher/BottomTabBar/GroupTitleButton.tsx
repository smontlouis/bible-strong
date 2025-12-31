import React, { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { BottomSheetModal } from '@gorhom/bottom-sheet'
import Box, { AnimatedBox, FadingText } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import PopOverMenu from '~common/PopOverMenu'
import { useActiveGroup, useUpdateGroup, getTabGroups } from '../../../state/tabGroups'
import { tabsCountAtom } from '../../../state/tabs'
import { useAtomValue } from 'jotai/react'
import GroupActionsPopover from './GroupActionsPopover'
import EditGroupModal from './EditGroupModal'
import { useAppSwitcherContext } from '../AppSwitcherProvider'
import { LinearTransition } from 'react-native-reanimated'
import useCurrentThemeSelector from '~helpers/useCurrentThemeSelector'
import { getContrastTextColor } from '~helpers/highlightUtils'

const GroupTitleButton = () => {
  const { t } = useTranslation()
  const activeGroup = useActiveGroup()
  const tabsCount = useAtomValue(tabsCountAtom)
  const updateGroup = useUpdateGroup()
  const editSheetRef = useRef<BottomSheetModal>(null)
  const { groupPager } = useAppSwitcherContext()
  const { colorScheme } = useCurrentThemeSelector()

  const textColor = activeGroup.color
    ? getContrastTextColor(activeGroup.color, colorScheme === 'dark')
    : undefined

  const displayName = activeGroup.isDefault
    ? `${tabsCount} ${t('tabs.tab', { count: tabsCount })}`
    : activeGroup.name

  const handleOpenCreateGroup = () => {
    // Navigate to the create group page (last page in carousel)
    // Read groups.length only when needed (no subscription)
    const groupsLength = getTabGroups().length
    groupPager.navigateToPage(groupsLength, groupsLength)
  }

  const handleOpenEdit = () => {
    editSheetRef.current?.present()
  }

  const handleEdit = ({ name, color }: { name: string; color: string }) => {
    updateGroup({ groupId: activeGroup.id, name, color })
  }

  return (
    <Box flex={1}>
      <PopOverMenu
        element={
          <Box row center>
            <AnimatedBox
              row
              py={6}
              px={12}
              borderRadius={20}
              layout={LinearTransition}
              style={{
                backgroundColor: activeGroup.color || 'transparent',
                transitionProperty: 'backgroundColor',
                transitionDuration: 300,
              }}
            >
              <FadingText color={textColor || 'default'} fontSize={14} numberOfLines={1}>
                {displayName}
              </FadingText>
              <AnimatedBox layout={LinearTransition}>
                <FeatherIcon
                  name="chevron-down"
                  size={16}
                  color={textColor || 'default'}
                  style={{ marginLeft: 4 }}
                />
              </AnimatedBox>
            </AnimatedBox>
          </Box>
        }
        popover={
          <GroupActionsPopover
            group={activeGroup}
            onCreateGroup={handleOpenCreateGroup}
            onEditGroup={handleOpenEdit}
          />
        }
      />
      {!activeGroup.isDefault && (
        <EditGroupModal
          bottomSheetRef={editSheetRef}
          initialName={activeGroup.name}
          initialColor={activeGroup.color}
          onSave={handleEdit}
        />
      )}
    </Box>
  )
}

export default GroupTitleButton
