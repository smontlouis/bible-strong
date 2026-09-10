import { useConfirmDialog } from '~common/ConfirmDialog/useConfirmDialog'
import { ActionSheetItem } from '~common/ActionMenu'
import { Sheet, SheetView, type SheetRef } from '~common/sheet'
import { useAtomValue, useSetAtom } from 'jotai/react'
import React, { memo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { type StyleProp, type ViewStyle } from 'react-native'
import Box, { TouchableBox } from '~common/ui/Box'
import { useDeleteGroup } from '../../../state/tabGroups'
import { TabGroup, closeAllTabsAtom, tabGroupsAtom } from '../../../state/tabs'
import { useAppSwitcherContext } from '../AppSwitcherContext'
export interface GroupActionsPopoverProps {
  triggerStyle?: StyleProp<ViewStyle>
  accessibilityLabel: string
  children: React.ReactNode
  group: TabGroup
  onCreateGroup: () => void
  onEditGroup: () => void
  onViewGroups: () => void
  onGroupCreated?: () => void
}

const GroupActionsPopover = memo(
  ({
    triggerStyle,
    accessibilityLabel,
    children,
    group,
    onCreateGroup,
    onEditGroup,
    onViewGroups,
  }: GroupActionsPopoverProps) => {
    const { t } = useTranslation()
    const confirmDeletion = useConfirmDialog()
    const sheetRef = useRef<SheetRef>(null)
    const closeAllTabs = useSetAtom(closeAllTabsAtom)
    const deleteGroup = useDeleteGroup()
    const groups = useAtomValue(tabGroupsAtom)
    const { groupPager } = useAppSwitcherContext()

    const closeSheet = () => {
      sheetRef.current?.dismiss()
    }

    const handleCloseAllTabs = () => {
      closeAllTabs(group.id)
      closeSheet()
    }

    const handleEdit = () => {
      closeSheet()
      onEditGroup()
    }

    const handleDelete = () => {
      closeSheet()
      void confirmDeletion({
        title: t('tabs.deleteGroupTitle'),
        message: t('tabs.deleteGroupMessage'),
        cancelLabel: t('common.cancel'),
        confirmLabel: t('common.delete'),
        destructive: true,
      }).then(confirmed => {
        if (!confirmed) return
        const currentIndex = groups.findIndex(g => g.id === group.id)
        const targetIndex = Math.max(0, currentIndex - 1)
        deleteGroup(group.id)
        groupPager.navigateToPage(targetIndex, groups.length - 1)
      })
    }

    const handleCreateGroup = () => {
      closeSheet()
      onCreateGroup()
    }

    const handleViewGroups = () => {
      closeSheet()
      onViewGroups()
    }

    return (
      <>
        <TouchableBox
          className="overflow-hidden border-continuous"
          style={triggerStyle}
          onPress={() => {
            sheetRef.current?.present()
          }}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
        >
          {children}
        </TouchableBox>
        <Sheet ref={sheetRef} detached>
          <SheetView>
            <Box className="overflow-hidden border-continuous min-w-[200px]">
              <ActionSheetItem
                icon="x-circle"
                label={t('tabs.closeAll')}
                onPress={handleCloseAllTabs}
              />
              {!group.isDefault && (
                <>
                  <ActionSheetItem icon="edit-2" label={t('tabs.editGroup')} onPress={handleEdit} />
                  <ActionSheetItem
                    icon="trash-2"
                    label={t('tabs.deleteGroup')}
                    onPress={handleDelete}
                    color="quart"
                  />
                </>
              )}
              <Box className="overflow-hidden border-continuous h-[1px] bg-border" />
              <ActionSheetItem icon="plus" label={t('tabs.newGroup')} onPress={handleCreateGroup} />
              <ActionSheetItem
                icon="layers"
                label={t('tabs.viewMyGroups')}
                onPress={handleViewGroups}
              />
            </Box>
          </SheetView>
        </Sheet>
      </>
    )
  }
)

GroupActionsPopover.displayName = 'GroupActionsPopover'

export default GroupActionsPopover
