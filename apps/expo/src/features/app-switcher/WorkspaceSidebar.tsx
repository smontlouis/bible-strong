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
      width={WORKSPACE_SIDEBAR_WIDTH}
      bg="lightGrey"
      borderRightWidth={1}
      borderColor="border"
      pt={insets.top}
      pb={insets.bottom}
    >
      <HStack alignItems="center" pl={20} pr={8} py={10}>
        <FeatherIcon name="book-open" size={19} color="primary" />
        <Text flex={1} ml={10} bold fontSize={15}>
          Bible Strong
        </Text>
        <TouchableBox
          size={40}
          center
          onPress={onCollapse}
          accessibilityRole="button"
          accessibilityLabel={t('workspace.hideSidebar')}
        >
          <FeatherIcon name="sidebar" size={18} color="grey" />
        </TouchableBox>
      </HStack>
      <TouchableBox
        row
        alignItems="center"
        mx={6}
        px={10}
        minHeight={rowHeight}
        borderRadius={8}
        onPress={openHome}
        accessibilityRole="button"
        accessibilityLabel={t('Accueil')}
      >
        <FeatherIcon name="home" size={17} color="grey" />
        <Text ml={10} fontSize={14}>
          {t('Accueil')}
        </Text>
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
            <Box key={group.id} gap={4}>
              {!group.isDefault && (
                <SidebarHoverActions>
                  {showActions => (
                    <HStack borderRadius={8} bg={groupColor} alignItems="center" overflow="hidden">
                      <TouchableBox
                        row
                        flex={1}
                        alignItems="center"
                        minHeight={groupHeight}
                        pl={8}
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
                      >
                        <Text flex={1} fontSize={12} bold color={groupTextColor} numberOfLines={1}>
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
                        <Box width={actionSize} height={groupHeight} center>
                          <FeatherIcon name="more-horizontal" size={15} color={groupTextColor} />
                        </Box>
                      </GroupActionsPopover>
                      <TouchableBox
                        width={actionSize}
                        height={groupHeight}
                        center
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
                  gap={0}
                  ml={group.isDefault ? 0 : 4}
                  pl={group.isDefault ? 0 : 5}
                  borderLeftWidth={group.isDefault ? 0 : 2}
                  borderColor={groupColor}
                >
                  {group.tabs.map((tab, index) => {
                    const selected = group.id === activeGroupId && tab.id === activeTabId
                    return (
                      <SidebarHoverActions key={tab.id}>
                        {showActions => (
                          <HStack
                            alignItems="center"
                            borderRadius={8}
                            overflow="hidden"
                            bg={selected ? 'reverse' : showActions ? 'default' : undefined}
                            bgOpacity={!selected && showActions ? '005' : undefined}
                          >
                            <TouchableBox
                              flex={1}
                              row
                              alignItems="center"
                              minHeight={rowHeight}
                              px={9}
                              onPress={() => selectTab(group.id, index)}
                              accessibilityRole="button"
                              accessibilityLabel={tab.title}
                              accessibilityState={{ selected }}
                            >
                              <TabIcon
                                type={tab.type}
                                size={14}
                                color={selected ? 'primary' : 'grey'}
                              />
                              <Text ml={8} flex={1} fontSize={12} numberOfLines={1}>
                                {tab.title}
                              </Text>
                            </TouchableBox>
                            {tab.isRemovable && (
                              <TouchableBox
                                width={actionSize}
                                height={rowHeight}
                                center
                                style={{ opacity: showActions ? 1 : 0 }}
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
                      minHeight={rowHeight}
                      justifyContent="center"
                      px={9}
                      onPress={() => {
                        switchGroup(group.id)
                        addTab()
                      }}
                      accessibilityRole="button"
                    >
                      <Text fontSize={12} color="grey">
                        {t('tabs.create')}
                      </Text>
                    </TouchableBox>
                  )}
                </Box>
              )}
            </Box>
          )
        })}
        {groups.length < MAX_TAB_GROUPS && (
          <TouchableBox
            row
            minHeight={rowHeight}
            alignItems="center"
            px={10}
            onPress={() => createRef.current?.present()}
            accessibilityRole="button"
          >
            <FeatherIcon name="folder-plus" size={16} color="grey" />
            <Text ml={10} fontSize={13} color="grey">
              {t('tabs.newGroup')}
            </Text>
          </TouchableBox>
        )}
      </ScrollView>
      <Box px={6} pt={8} pb={6} gap={6} borderTopWidth={1} borderColor="border">
        <TouchableBox
          row
          center
          minHeight={rowHeight}
          borderRadius={8}
          bg="reverse"
          onPress={addTab}
          accessibilityRole="button"
        >
          <FeatherIcon name="plus" size={17} color="primary" />
          <Text ml={8} fontSize={13}>
            {t('tabs.new')}
          </Text>
        </TouchableBox>
        <TouchableBox
          row
          alignItems="center"
          px={10}
          minHeight={rowHeight}
          onPress={openMenu}
          accessibilityRole="button"
        >
          <FeatherIcon name="settings" size={16} color="grey" />
          <Text ml={10} fontSize={13}>
            {t('settings.settings')}
          </Text>
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
