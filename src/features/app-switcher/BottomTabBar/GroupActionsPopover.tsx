import { useAtomValue, useSetAtom } from 'jotai/react'
import React, { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from 'react-native'
import { usePopOver } from '~common/PopOverContext'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { useDeleteGroup } from '../../../state/tabGroups'
import { TabGroup, closeAllTabsAtom, tabGroupsAtom } from '../../../state/tabs'
import { useAppSwitcherContext } from '../AppSwitcherProvider'

interface PopoverItemProps {
  icon: string
  label: string
  onPress: () => void
  destructive?: boolean
}

const PopoverItem = memo(({ icon, label, onPress, destructive }: PopoverItemProps) => {
  return (
    <TouchableBox row alignItems="center" py={8} px={16} onPress={onPress}>
      <FeatherIcon
        name={icon as any}
        size={18}
        color={destructive ? 'quart' : 'default'}
        style={{ marginRight: 12 }}
      />
      <Text color={destructive ? 'quart' : 'default'} fontSize={15}>
        {label}
      </Text>
    </TouchableBox>
  )
})

PopoverItem.displayName = 'PopoverItem'

interface GroupActionsPopoverProps {
  group: TabGroup
  onCreateGroup: () => void
  onEditGroup: () => void
}

const GroupActionsPopover = memo(
  ({ group, onCreateGroup, onEditGroup }: GroupActionsPopoverProps) => {
    const { t } = useTranslation()
    const { onClose } = usePopOver()
    const closeAllTabs = useSetAtom(closeAllTabsAtom)
    const deleteGroup = useDeleteGroup()
    const groups = useAtomValue(tabGroupsAtom)
    const { groupPager } = useAppSwitcherContext()

    const handleCloseAllTabs = () => {
      closeAllTabs()
      onClose()
    }

    const handleEdit = () => {
      onClose()
      // Small delay to let the popover close before opening the bottom sheet
      setTimeout(() => {
        onEditGroup()
      }, 100)
    }

    const handleDelete = () => {
      onClose()
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
      onClose()
      // Small delay to let the popover close before opening the bottom sheet
      setTimeout(() => {
        onCreateGroup()
      }, 100)
    }

    return (
      <Box minWidth={200}>
        <PopoverItem icon="x-circle" label={t('tabs.closeAll')} onPress={handleCloseAllTabs} />
        {!group.isDefault && (
          <>
            <PopoverItem icon="edit-2" label={t('tabs.editGroup')} onPress={handleEdit} />
            <PopoverItem
              icon="trash-2"
              label={t('tabs.deleteGroup')}
              onPress={handleDelete}
              destructive
            />
          </>
        )}
        <Box height={1} bg="border" marginVertical={4} />
        <PopoverItem icon="plus" label={t('tabs.newGroup')} onPress={handleCreateGroup} />
      </Box>
    )
  }
)

GroupActionsPopover.displayName = 'GroupActionsPopover'

export default GroupActionsPopover
