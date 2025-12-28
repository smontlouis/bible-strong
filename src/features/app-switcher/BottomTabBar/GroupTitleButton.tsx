import React, { memo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { BottomSheetModal } from '@gorhom/bottom-sheet'
import Box, { AnimatedBox, FadingText } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import PopOverMenu from '~common/PopOverMenu'
import { useActiveGroup, useRenameGroup } from '../../../state/tabGroups'
import { tabsCountAtom } from '../../../state/tabs'
import { useAtomValue } from 'jotai/react'
import GroupActionsPopover from './GroupActionsPopover'
import RenameModal from '~common/RenameModal'
import { useAppSwitcherContext } from '../AppSwitcherProvider'
import { LinearTransition } from 'react-native-reanimated'

const GroupTitleButton = memo(() => {
  const { t } = useTranslation()
  const activeGroup = useActiveGroup()
  const tabsCount = useAtomValue(tabsCountAtom)
  const renameGroup = useRenameGroup()
  const renameSheetRef = useRef<BottomSheetModal>(null)
  const { createGroupPage } = useAppSwitcherContext()

  const displayName = activeGroup.isDefault
    ? `${tabsCount} ${t('tabs.tab', { count: tabsCount })}`
    : activeGroup.name

  const handleOpenCreateGroup = () => {
    // Navigate to the create group page instead of opening bottom sheet
    createGroupPage.navigateTo.current?.()
  }

  const handleOpenRename = () => {
    renameSheetRef.current?.present()
  }

  const handleRename = (newName: string) => {
    renameGroup({ groupId: activeGroup.id, newName })
  }

  return (
    <Box flex={1}>
      <PopOverMenu
        element={
          <AnimatedBox row center py={8} px={12} layout={LinearTransition}>
            <FadingText color="default" fontSize={14}>
              {displayName}
            </FadingText>
            <AnimatedBox layout={LinearTransition}>
              <FeatherIcon
                name="chevron-down"
                size={16}
                color="tertiary"
                style={{ marginLeft: 4 }}
              />
            </AnimatedBox>
          </AnimatedBox>
        }
        popover={
          <GroupActionsPopover
            group={activeGroup}
            onCreateGroup={handleOpenCreateGroup}
            onRenameGroup={handleOpenRename}
          />
        }
      />
      {!activeGroup.isDefault && (
        <RenameModal
          bottomSheetRef={renameSheetRef}
          title={t('tabs.renameGroup')}
          placeholder={t('tabs.groupNamePlaceholder')}
          initialValue={activeGroup.name}
          onSave={handleRename}
        />
      )}
    </Box>
  )
})

GroupTitleButton.displayName = 'GroupTitleButton'

export default GroupTitleButton
