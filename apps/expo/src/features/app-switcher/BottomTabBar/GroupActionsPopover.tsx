import { ActionSheetItem } from '~common/ActionMenu'
import { Sheet, SheetView, type SheetRef } from '~common/sheet'
import { useAtomValue, useSetAtom } from 'jotai/react'
import React, { memo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, type StyleProp, type ViewStyle } from 'react-native'
import Box, { TouchableBox } from '~common/ui/Box'
import { useDeleteGroup } from '../../../state/tabGroups'
import { TabGroup, closeAllTabsAtom, tabGroupsAtom } from '../../../state/tabs'
import { useAppSwitcherContext } from '../AppSwitcherContext'
export interface GroupActionsPopoverProps {
  triggerStyle?: StyleProp<ViewStyle>
  onOpen?: () => void
  accessibilityLabel: string
  children: React.ReactNode
  group: TabGroup
  onCreateGroup: () => void
  onEditGroup: () => void
  onViewGroups: () => void
}

const GroupActionsPopover = memo(
  ({
    triggerStyle,
    onOpen,
    accessibilityLabel,
    children,
    group,
    onCreateGroup,
    onEditGroup,
    onViewGroups,
  }: GroupActionsPopoverProps) => {
    const { t } = useTranslation()
    const sheetRef = useRef<SheetRef>(null)
    const closeAllTabs = useSetAtom(closeAllTabsAtom)
    const deleteGroup = useDeleteGroup()
    const groups = useAtomValue(tabGroupsAtom)
    const { groupPager } = useAppSwitcherContext()

    const closeSheet = () => {
      sheetRef.current?.dismiss()
    }

    const handleCloseAllTabs = () => {
      closeAllTabs()
      closeSheet()
    }

    const handleEdit = () => {
      closeSheet()
      onEditGroup()
    }

    const handleDelete = () => {
      closeSheet()
      Alert.alert(t('tabs.deleteGroupTitle'), t('tabs.deleteGroupMessage'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            // Calculer l'index de navigation AVANT la suppression
            const currentIndex = groups.findIndex(g => g.id === group.id)
            const targetIndex = Math.max(0, currentIndex - 1)

            // Supprimer le groupe
            deleteGroup(group.id)

            // Naviguer vers le groupe précédent (ou default)
            groupPager.navigateToPage(targetIndex, groups.length - 1)
          },
        },
      ])
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
            onOpen?.()
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
