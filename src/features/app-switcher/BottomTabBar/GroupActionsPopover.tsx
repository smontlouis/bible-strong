import { MenuView, type MenuAction } from '@expo/ui/community/menu'
import { useAtomValue, useSetAtom } from 'jotai/react'
import React, { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from 'react-native'
import { useDeleteGroup } from '../../../state/tabGroups'
import { TabGroup, closeAllTabsAtom, tabGroupsAtom } from '../../../state/tabs'
import { useAppSwitcherContext } from '../AppSwitcherProvider'

interface GroupActionsPopoverProps {
  children: React.ReactNode
  group: TabGroup
  onCreateGroup: () => void
  onEditGroup: () => void
  onViewGroups: () => void
}

const GroupActionsPopover = memo(
  ({ children, group, onCreateGroup, onEditGroup, onViewGroups }: GroupActionsPopoverProps) => {
    const { t } = useTranslation()
    const closeAllTabs = useSetAtom(closeAllTabsAtom)
    const deleteGroup = useDeleteGroup()
    const groups = useAtomValue(tabGroupsAtom)
    const { groupPager } = useAppSwitcherContext()

    const handleCloseAllTabs = () => {
      closeAllTabs()
    }

    const handleEdit = () => {
      setTimeout(() => {
        onEditGroup()
      }, 100)
    }

    const handleDelete = () => {
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
      setTimeout(() => {
        onCreateGroup()
      }, 100)
    }

    const handleViewGroups = () => {
      setTimeout(() => {
        onViewGroups()
      }, 100)
    }

    const actions: MenuAction[] = [
      {
        id: 'close-all',
        title: t('tabs.closeAll'),
        image: 'xmark.circle' as const,
      },
      ...(!group.isDefault
        ? [
            {
              id: 'edit',
              title: t('tabs.editGroup'),
              image: 'pencil' as const,
            },
            {
              id: 'delete',
              title: t('tabs.deleteGroup'),
              image: 'trash' as const,
              attributes: { destructive: true },
            },
          ]
        : []),
      {
        id: 'new-group',
        title: t('tabs.newGroup'),
        image: 'plus.circle' as const,
      },
      {
        id: 'view-groups',
        title: t('tabs.viewMyGroups'),
        image: 'square.stack.3d.up' as const,
      },
    ]

    return (
      <MenuView
        actions={actions}
        onPressAction={({ nativeEvent }) => {
          switch (nativeEvent.event) {
            case 'close-all':
              handleCloseAllTabs()
              break
            case 'edit':
              handleEdit()
              break
            case 'delete':
              handleDelete()
              break
            case 'new-group':
              handleCreateGroup()
              break
            case 'view-groups':
              handleViewGroups()
              break
          }
        }}
      >
        {children}
      </MenuView>
    )
  }
)

GroupActionsPopover.displayName = 'GroupActionsPopover'

export default GroupActionsPopover
