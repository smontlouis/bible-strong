import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet'
import { useTheme } from '@emotion/react'
import { useAtomValue, useSetAtom } from 'jotai/react'
import React, { memo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ContainerComponent } from '~common/Modal'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { renderBackdrop } from '~helpers/bottomSheetHelpers'
import { useDeleteGroup } from '../../../state/tabGroups'
import { TabGroup, closeAllTabsAtom, tabGroupsAtom } from '../../../state/tabs'
import { TAB_ICON_SIZE } from '../utils/constants'
import { useAppSwitcherContext } from '../AppSwitcherProvider'

interface GroupActionsPopoverProps {
  children: React.ReactNode
  group: TabGroup
  onCreateGroup: () => void
  onEditGroup: () => void
  onViewGroups: () => void
}

type FeatherIconName = React.ComponentProps<typeof FeatherIcon>['name']

interface PopoverItemProps {
  icon: FeatherIconName
  label: string
  onPress: () => void
  destructive?: boolean
}

const PopoverItem = memo(({ icon, label, onPress, destructive }: PopoverItemProps) => {
  return (
    <TouchableBox row alignItems="center" py={8} px={16} onPress={onPress}>
      <FeatherIcon
        name={icon}
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

const GroupActionsPopover = memo(
  ({ children, group, onCreateGroup, onEditGroup, onViewGroups }: GroupActionsPopoverProps) => {
    const { t } = useTranslation()
    const theme = useTheme()
    const insets = useSafeAreaInsets()
    const { width: windowWidth } = useWindowDimensions()
    const bottomSheetRef = useRef<BottomSheetModal>(null)
    const closeAllTabs = useSetAtom(closeAllTabsAtom)
    const deleteGroup = useDeleteGroup()
    const groups = useAtomValue(tabGroupsAtom)
    const { groupPager } = useAppSwitcherContext()
    const sheetWidth = Math.min(250, windowWidth - 40)
    const bottomBarHeight = TAB_ICON_SIZE + insets.bottom

    const closeSheet = () => {
      bottomSheetRef.current?.dismiss()
    }

    const handleCloseAllTabs = () => {
      closeAllTabs()
      closeSheet()
    }

    const handleEdit = () => {
      closeSheet()
      setTimeout(() => {
        onEditGroup()
      }, 100)
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
      setTimeout(() => {
        onCreateGroup()
      }, 100)
    }

    const handleViewGroups = () => {
      closeSheet()
      setTimeout(() => {
        onViewGroups()
      }, 100)
    }

    return (
      <>
        <TouchableBox onPress={() => bottomSheetRef.current?.present()}>{children}</TouchableBox>
        <BottomSheetModal
          ref={bottomSheetRef}
          detached
          bottomInset={bottomBarHeight}
          enableDynamicSizing
          enablePanDownToClose
          backdropComponent={props => renderBackdrop({ ...props, opacity: 0.2 })}
          containerComponent={ContainerComponent}
          style={{
            width: sheetWidth,
            marginLeft: (windowWidth - sheetWidth) / 2,
            borderRadius: 16,
            overflow: 'hidden',
          }}
          backgroundStyle={{
            backgroundColor: theme.colors.reverse,
            borderRadius: 16,
          }}
        >
          <BottomSheetView>
            <Box minWidth={200} py={6}>
              <PopoverItem
                icon="x-circle"
                label={t('tabs.closeAll')}
                onPress={handleCloseAllTabs}
              />
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
              <PopoverItem
                icon="layers"
                label={t('tabs.viewMyGroups')}
                onPress={handleViewGroups}
              />
            </Box>
          </BottomSheetView>
        </BottomSheetModal>
      </>
    )
  }
)

GroupActionsPopover.displayName = 'GroupActionsPopover'

export default GroupActionsPopover
