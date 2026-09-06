import { resolveThemeColor, colorWithOpacity } from '~themes/colorValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import { useAtomValue, useSetAtom, useStore } from 'jotai/react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Platform, ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { SheetRef } from '~common/sheet'
import Box, { HStack, TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import SidebarHoverActions from '~common/ui/HoverActionsRow'
import { getContrastTextColor } from '~helpers/highlightUtils'
import useCurrentThemeSelector from '~helpers/useCurrentThemeSelector'
import { useCreateGroup, useSwitchGroup, useUpdateGroup } from '~state/tabGroups'
import {
  activeGroupIdAtom,
  activeTabIdAtom,
  activeTabIndexAtom,
  appSwitcherModeAtom,
  cachedTabIdsAtom,
  getGroupTabsAtomsAtom,
  MAX_TAB_GROUPS,
  tabGroupsAtom,
  type TabGroup,
} from '~state/tabs'
import EditGroupModal from './BottomTabBar/EditGroupModal'
import GroupActionsPopover from './BottomTabBar/GroupActionsPopover'
import ViewGroupsModal from './BottomTabBar/ViewGroupsModal'
import TabIcon from './utils/getIconByTabType'
import { useOpenInNewTab } from './utils/useOpenInNewTab'
import { WORKSPACE_SIDEBAR_WIDTH } from './utils/useResponsiveWorkspace'
interface WorkspaceSidebarProps {
  onCollapse: () => void
  openHome: () => void
  openMenu: () => void
}

const WorkspaceSidebar = ({ onCollapse, openHome, openMenu }: WorkspaceSidebarProps) => {
  const stylingTheme = useStylingTheme()

  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const { colorScheme } = useCurrentThemeSelector()
  const rowHeight = Platform.OS === 'web' ? 32 : 44
  const groupHeight = Platform.OS === 'web' ? 26 : 44
  const actionSize = Platform.OS === 'web' ? 28 : 44
  const groups = useAtomValue(tabGroupsAtom)
  const activeGroupId = useAtomValue(activeGroupIdAtom)
  const activeTabId = useAtomValue(activeTabIdAtom)
  const store = useStore()
  const switchGroup = useSwitchGroup()
  const createGroup = useCreateGroup()
  const updateGroup = useUpdateGroup()
  const setActiveIndex = useSetAtom(activeTabIndexAtom)
  const setMode = useSetAtom(appSwitcherModeAtom)
  const openInNewTab = useOpenInNewTab()
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([])
  const [editingGroup, setEditingGroup] = useState<TabGroup | null>(null)
  const editRef = useRef<SheetRef>(null)
  const createRef = useRef<SheetRef>(null)
  const viewGroupsRef = useRef<SheetRef>(null)

  useEffect(() => {
    if (editingGroup) editRef.current?.present()
  }, [editingGroup])

  const selectTab = (groupId: string, index: number) => {
    switchGroup(groupId)
    setActiveIndex(index)
    setMode('view')
  }

  const closeTab = (group: TabGroup, tabId: string) => {
    const groupAtoms = getGroupTabsAtomsAtom(group.id)
    const tabAtom = store.get(groupAtoms).find(item => store.get(item).id === tabId)
    if (!tabAtom || !store.get(tabAtom).isRemovable) return
    // Closing an earlier row must not change the selected content.
    const selectedId = group.tabs[group.activeTabIndex]?.id
    store.set(groupAtoms, { type: 'remove', atom: tabAtom })
    store.set(
      cachedTabIdsAtom,
      store.get(cachedTabIdsAtom).filter(id => id !== tabId)
    )
    const remainingGroup = store.get(tabGroupsAtom).find(item => item.id === group.id)
    const selectedIndex = remainingGroup?.tabs.findIndex(tab => tab.id === selectedId) ?? -1
    if (selectedIndex >= 0) {
      store.set(tabGroupsAtom, current =>
        current.map(item =>
          item.id === group.id ? { ...item, activeTabIndex: selectedIndex } : item
        )
      )
    }
  }

  const addTab = () => openInNewTab(undefined, { autoRedirect: true })

  return (
    <Box
      className="border-continuous overflow-hidden bg-light-grey border-r-[1px] border-border"
      style={{
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
        width: WORKSPACE_SIDEBAR_WIDTH,
      }}
    >
      <HStack className="overflow-hidden border-continuous items-center pl-[20px] pr-[8px] py-[10px]">
        <FeatherIcon name="book-open" size={19} color="primary" />
        <Text className="flex-[1] ml-[10px] font-bold text-[15px]">Bible Strong</Text>
        <TouchableBox
          className="overflow-hidden border-continuous items-center justify-center"
          onPress={onCollapse}
          accessibilityRole="button"
          accessibilityLabel={t('workspace.hideSidebar')}
          style={{ width: 40, height: 40 }}
        >
          <FeatherIcon name="sidebar" size={18} color="grey" />
        </TouchableBox>
      </HStack>
      <TouchableBox
        className="overflow-hidden border-continuous flex-row items-center mx-[6px] px-[10px] rounded-[8px]"
        onPress={openHome}
        accessibilityRole="button"
        accessibilityLabel={t('Accueil')}
        style={{ minHeight: rowHeight }}
      >
        <FeatherIcon name="home" size={17} color="grey" />
        <Text className="ml-[10px] text-[14px]">{t('Accueil')}</Text>
      </TouchableBox>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 6, gap: 6 }}>
        {[
          ...groups.filter(group => group.isDefault),
          ...groups.filter(group => !group.isDefault),
        ].map(group => {
          const collapsed = !group.isDefault && collapsedGroups.includes(group.id)
          const groupColor = group.color || '#64748b'
          const groupTextColor =
            getContrastTextColor(groupColor, colorScheme === 'dark') || 'default'
          return (
            <Box className="overflow-hidden border-continuous gap-[4px]" key={group.id}>
              {!group.isDefault && (
                <SidebarHoverActions>
                  {showActions => (
                    <HStack
                      className="border-continuous overflow-visible rounded-[8px] items-center"
                      style={{ backgroundColor: resolveThemeColor(stylingTheme, groupColor) }}
                    >
                      <TouchableBox
                        className="overflow-hidden border-continuous flex-row flex-[1] items-center pl-[8px]"
                        onPress={() =>
                          setCollapsedGroups(current =>
                            collapsed
                              ? current.filter(id => id !== group.id)
                              : [...current, group.id]
                          )
                        }
                        accessibilityRole="button"
                        accessibilityLabel={group.name}
                        accessibilityState={{ expanded: !collapsed }}
                        style={{ minHeight: groupHeight }}
                      >
                        <Text
                          className="flex-[1] text-[12px] font-bold"
                          numberOfLines={1}
                          style={{
                            color:
                              resolveThemeColor(stylingTheme, groupTextColor) ||
                              stylingTheme.colors.default,
                          }}
                        >
                          {group.name}
                        </Text>
                      </TouchableBox>
                      <GroupActionsPopover
                        group={group}
                        triggerStyle={{ opacity: showActions ? 1 : 0 }}
                        accessibilityLabel={t('workspace.groupActions', { name: group.name })}
                        onCreateGroup={() => createRef.current?.present()}
                        onEditGroup={() => setEditingGroup(group)}
                        onViewGroups={() => viewGroupsRef.current?.present()}
                        onOpen={() => switchGroup(group.id)}
                      >
                        <Box
                          className="overflow-hidden border-continuous items-center justify-center"
                          style={{ width: actionSize, height: groupHeight }}
                        >
                          <FeatherIcon name="more-horizontal" size={15} color={groupTextColor} />
                        </Box>
                      </GroupActionsPopover>
                      <TouchableBox
                        className="overflow-hidden border-continuous items-center justify-center"
                        onPress={() =>
                          setCollapsedGroups(current =>
                            collapsed
                              ? current.filter(id => id !== group.id)
                              : [...current, group.id]
                          )
                        }
                        accessibilityRole="button"
                        accessibilityLabel={group.name}
                        accessibilityState={{ expanded: !collapsed }}
                        style={{ width: actionSize, height: groupHeight }}
                      >
                        <FeatherIcon
                          name={collapsed ? 'chevron-down' : 'chevron-up'}
                          size={14}
                          color={groupTextColor}
                        />
                      </TouchableBox>
                    </HStack>
                  )}
                </SidebarHoverActions>
              )}
              {!collapsed && (
                <Box
                  className="overflow-hidden border-continuous gap-[0px]"
                  style={{
                    paddingLeft: group.isDefault ? 0 : 5,
                    marginLeft: group.isDefault ? 0 : 4,
                    borderLeftWidth: group.isDefault ? 0 : 2,
                    borderColor: resolveThemeColor(stylingTheme, groupColor),
                  }}
                >
                  {group.tabs.map((tab, index) => {
                    const selected = group.id === activeGroupId && tab.id === activeTabId
                    return (
                      <SidebarHoverActions key={tab.id}>
                        {showActions => (
                          <HStack
                            className="border-continuous overflow-visible items-center rounded-[8px]"
                            style={{
                              backgroundColor: colorWithOpacity(
                                resolveThemeColor(
                                  stylingTheme,
                                  selected ? 'reverse' : showActions ? 'default' : undefined
                                ),
                                !selected && showActions ? 0.05 : undefined
                              ),
                            }}
                          >
                            <TouchableBox
                              className="overflow-hidden border-continuous flex-[1] flex-row items-center px-[9px]"
                              onPress={() => selectTab(group.id, index)}
                              accessibilityRole="button"
                              accessibilityLabel={tab.title}
                              accessibilityState={{ selected }}
                              style={{ minHeight: rowHeight }}
                            >
                              <TabIcon
                                type={tab.type}
                                size={14}
                                color={selected ? 'primary' : 'grey'}
                              />
                              <Text className="ml-[8px] flex-[1] text-[12px]" numberOfLines={1}>
                                {tab.title}
                              </Text>
                            </TouchableBox>
                            {tab.isRemovable && (
                              <TouchableBox
                                className="overflow-hidden border-continuous items-center justify-center"
                                style={[
                                  { width: actionSize, height: rowHeight },
                                  { opacity: showActions ? 1 : 0 },
                                ]}
                                onPress={() => closeTab(group, tab.id)}
                                accessibilityRole="button"
                                accessibilityLabel={t('workspace.closeTab', { title: tab.title })}
                              >
                                <FeatherIcon name="x" size={14} color="grey" />
                              </TouchableBox>
                            )}
                          </HStack>
                        )}
                      </SidebarHoverActions>
                    )
                  })}
                  {group.tabs.length === 0 && !group.isDefault && (
                    <TouchableBox
                      className="overflow-hidden border-continuous justify-center px-[9px]"
                      onPress={() => {
                        switchGroup(group.id)
                        addTab()
                      }}
                      accessibilityRole="button"
                      style={{ minHeight: rowHeight }}
                    >
                      <Text className="text-[12px] text-grey">{t('tabs.create')}</Text>
                    </TouchableBox>
                  )}
                </Box>
              )}
            </Box>
          )
        })}
        {groups.length < MAX_TAB_GROUPS && (
          <TouchableBox
            className="overflow-hidden border-continuous flex-row items-center px-[10px]"
            onPress={() => createRef.current?.present()}
            accessibilityRole="button"
            style={{ minHeight: rowHeight }}
          >
            <FeatherIcon name="folder-plus" size={16} color="grey" />
            <Text className="ml-[10px] text-[13px] text-grey">{t('tabs.newGroup')}</Text>
          </TouchableBox>
        )}
      </ScrollView>
      <Box className="border-continuous overflow-hidden px-[6px] pt-[8px] pb-[6px] gap-[6px] border-t-[1px] border-border">
        <TouchableBox
          className="overflow-hidden border-continuous flex-row items-center justify-center rounded-[8px] bg-reverse"
          onPress={addTab}
          accessibilityRole="button"
          style={{ minHeight: rowHeight }}
        >
          <FeatherIcon name="plus" size={17} color="primary" />
          <Text className="ml-[8px] text-[13px]">{t('tabs.new')}</Text>
        </TouchableBox>
        <TouchableBox
          className="overflow-hidden border-continuous flex-row items-center px-[10px]"
          onPress={openMenu}
          accessibilityRole="button"
          style={{ minHeight: rowHeight }}
        >
          <FeatherIcon name="settings" size={16} color="grey" />
          <Text className="ml-[10px] text-[13px]">{t('settings.settings')}</Text>
        </TouchableBox>
      </Box>
      <EditGroupModal
        sheetRef={editRef}
        onClose={() => setEditingGroup(null)}
        initialName={editingGroup?.name}
        initialColor={editingGroup?.color}
        onSave={data => {
          if (editingGroup) updateGroup({ groupId: editingGroup.id, ...data })
        }}
      />
      <EditGroupModal
        sheetRef={createRef}
        title={t('tabs.newGroupTitle')}
        onSave={data => {
          const id = createGroup(data)
          if (id) selectTab(id, 0)
        }}
      />
      <ViewGroupsModal sheetRef={viewGroupsRef} />
    </Box>
  )
}

export default WorkspaceSidebar
