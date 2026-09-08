import { useRef } from 'react'
import { useAtomValue, useSetAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import ContextualPanel from '~common/ContextualPanel'
import PanelAction from '~common/ContextualPanel/PanelAction'
import { useConfirmDialog } from '~common/ConfirmDialog/useConfirmDialog'
import type { SheetRef } from '~common/sheet'
import Box from '~common/ui/Box'
import { useDeleteGroup, useUpdateGroup } from '~state/tabGroups'
import { closeAllTabsAtom, tabGroupsAtom } from '~state/tabs'
import { useAppSwitcherContext } from '../AppSwitcherContext'
import EditGroupModal from './EditGroupModal'
import type { GroupActionsPopoverProps } from './GroupActionsPopover'

export default function GroupActionsPopover(props: GroupActionsPopoverProps) {
  const { t } = useTranslation()
  const ref = useRef<SheetRef>(null)
  const closeTabs = useSetAtom(closeAllTabsAtom)
  const update = useUpdateGroup()
  const remove = useDeleteGroup()
  const groups = useAtomValue(tabGroupsAtom)
  const { groupPager } = useAppSwitcherContext()
  const confirm = useConfirmDialog()
  return (
    <ContextualPanel
      trigger={<Box style={props.triggerStyle}>{props.children}</Box>}
      accessibilityLabel={props.accessibilityLabel}
      onOpen={props.onOpen}
      initialScreen="actions"
      screens={{
        actions: {
          title: props.group.name,
          content: navigation => (
            <>
              <PanelAction
                icon="x-circle"
                label={t('tabs.closeAll')}
                onPress={() => {
                  closeTabs()
                  navigation.close()
                }}
              />
              {!props.group.isDefault && (
                <>
                  <PanelAction
                    nested
                    icon="edit-2"
                    label={t('tabs.editGroup')}
                    onPress={() => navigation.open('edit')}
                  />
                  <PanelAction
                    destructive
                    icon="trash-2"
                    label={t('tabs.deleteGroup')}
                    onPress={async () => {
                      navigation.close()
                      if (
                        await confirm({
                          title: t('tabs.deleteGroupTitle'),
                          message: t('tabs.deleteGroupMessage'),
                          cancelLabel: t('common.cancel'),
                          confirmLabel: t('common.delete'),
                          destructive: true,
                        })
                      ) {
                        const index = Math.max(
                          0,
                          groups.findIndex(group => group.id === props.group.id) - 1
                        )
                        remove(props.group.id)
                        groupPager.navigateToPage(index, groups.length - 1)
                      }
                    }}
                  />
                </>
              )}
              <PanelAction
                icon="plus"
                label={t('tabs.newGroup')}
                onPress={() => {
                  navigation.close()
                  props.onCreateGroup()
                }}
              />
              <PanelAction
                icon="layers"
                label={t('tabs.viewMyGroups')}
                onPress={() => {
                  navigation.close()
                  props.onViewGroups()
                }}
              />
            </>
          ),
        },
        edit: {
          title: t('tabs.editGroup'),
          width: 400,
          content: navigation => (
            <EditGroupModal
              inline
              sheetRef={ref}
              initialName={props.group.name}
              initialColor={props.group.color}
              onSave={data => update({ groupId: props.group.id, ...data })}
              onClose={navigation.back}
            />
          ),
        },
      }}
    />
  )
}
