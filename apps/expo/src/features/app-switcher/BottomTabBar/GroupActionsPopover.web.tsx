import { useAtomValue, useSetAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import ContextualPanel from '~common/ContextualPanel'
import PanelAction from '~common/ContextualPanel/PanelAction'
import { useConfirmDialog } from '~common/ConfirmDialog/useConfirmDialog'
import Box, { TouchableBox } from '~common/ui/Box'
import { useTheme } from '~themes/ThemeProvider'
import { webFontFamily } from '~helpers/webFontFamily'
import { useDebouncedGroupEdit } from './useDebouncedGroupEdit'
import { useDeleteGroup, useUpdateGroup } from '~state/tabGroups'
import { GROUP_COLORS, closeAllTabsAtom, tabGroupsAtom } from '~state/tabs'
import { useAppSwitcherContext } from '../AppSwitcherContext'
import type { GroupActionsPopoverProps } from './GroupActionsPopover'

export default function GroupActionsPopover(props: GroupActionsPopoverProps) {
  const { t } = useTranslation()
  const closeTabs = useSetAtom(closeAllTabsAtom)
  const update = useUpdateGroup()
  const remove = useDeleteGroup()
  const groups = useAtomValue(tabGroupsAtom)
  const { groupPager } = useAppSwitcherContext()
  const confirm = useConfirmDialog()
  const theme = useTheme()
  const edit = useDebouncedGroupEdit(props.group, update)
  return (
    <ContextualPanel
      trigger={<Box style={props.triggerStyle}>{props.children}</Box>}
      accessibilityLabel={props.accessibilityLabel}
      onOpen={() => {
        edit.reset()
        props.onOpen?.()
      }}
      onClose={edit.flush}
      initialScreen="actions"
      screens={{
        actions: {
          title: props.group.name,
          hideHeader: !props.group.isDefault,
          headerContent: !props.group.isDefault ? (
            <Box className="p-3 gap-3 border-b border-border mb-1">
              <input
                aria-label={t('tabs.groupNamePlaceholder')}
                value={edit.name}
                autoFocus
                onFocus={event => event.currentTarget.select()}
                onChange={event => edit.changeName(event.target.value)}
                onBlur={edit.flush}
                onKeyDown={event => {
                  if (event.key === 'Enter') edit.flush()
                }}
                style={{
                  boxSizing: 'border-box',
                  width: '100%',
                  minWidth: 0,
                  height: 36,
                  borderRadius: 8,
                  border: `1px solid ${theme.colors.border}`,
                  background: theme.colors.reverse,
                  color: theme.colors.default,
                  fontFamily: webFontFamily(theme.fontFamily.text),
                  fontSize: 14,
                  padding: '0 10px',
                }}
              />
              <Box className="flex-row flex-wrap gap-2">
                {GROUP_COLORS.map((color, index) => (
                  <TouchableBox
                    key={color}
                    accessibilityRole="radio"
                    accessibilityLabel={t('accessibility.colorOption', { index: index + 1 })}
                    accessibilityState={{ checked: edit.color === color }}
                    onPress={() => edit.changeColor(color)}
                    className="w-[22px] h-[22px] rounded-full items-center justify-center"
                    style={{
                      borderWidth: 2,
                      borderColor: edit.color === color ? color : 'transparent',
                    }}
                  >
                    <Box
                      className="w-[14px] h-[14px] rounded-full"
                      style={{ backgroundColor: color }}
                    />
                  </TouchableBox>
                ))}
              </Box>
            </Box>
          ) : undefined,
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
            </>
          ),
        },
      }}
    />
  )
}
