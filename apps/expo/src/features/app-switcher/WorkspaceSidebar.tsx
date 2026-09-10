import { resolveUniverseColors } from '~themes/universeColors'
import {
  SidebarDragProvider,
  SidebarDragGroup,
  SidebarDragGroupHandle,
  SidebarDragTab,
} from './SidebarDragDrop'
import { useCloseWorkspaceTab } from './utils/useCloseWorkspaceTab'
import { resolveThemeColor, colorWithOpacity } from '~themes/colorValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import { useAtom, useAtomValue, useSetAtom } from 'jotai/react'
import { collapsedWorkspaceGroupsAtom } from '~state/workspacePreferences'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Image, Platform, ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { SheetRef } from '~common/sheet'
import Box, { HStack, TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import SidebarHoverActions from '~common/ui/HoverActionsRow'
import Color from 'color'
import useCurrentThemeSelector from '~helpers/useCurrentThemeSelector'
import { useCreateGroup, useSwitchGroup, useUpdateGroup } from '~state/tabGroups'
import {
  activeGroupIdAtom,
  activeTabIdAtom,
  activeTabIndexAtom,
  appSwitcherModeAtom,
  MAX_TAB_GROUPS,
  tabGroupsAtom,
  type TabGroup,
} from '~state/tabs'
import EditGroupModal from './BottomTabBar/EditGroupModal'
import GroupActionsPopover from '~features/app-switcher/BottomTabBar/GroupActionsPopover'
import ViewGroupsModal from './BottomTabBar/ViewGroupsModal'
import TabIcon, { tabIconColorConfig } from './utils/getIconByTabType'
import { useOpenInNewTab } from './utils/useOpenInNewTab'
import { WORKSPACE_SIDEBAR_WIDTH } from './utils/useResponsiveWorkspace'
interface WorkspaceSidebarProps {
  onCollapse: () => void
  onSelectContent?: () => void
  activePage?: 'home' | 'settings' | null
  isContentActive?: boolean
  openHome: () => void
  openMenu: () => void
}

const WorkspaceSidebar = ({
  onCollapse,
  openHome,
  openMenu,
  activePage,
  isContentActive = true,
  onSelectContent,
}: WorkspaceSidebarProps) => {
  const stylingTheme = useStylingTheme()

  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const { colorScheme } = useCurrentThemeSelector()
  const rowHeight = Platform.OS === 'web' ? 32 : 44
  const labelStyle = { color: colorScheme === 'dark' ? '#e3e3e3' : '#3c4043' }
  const actionSize = Platform.OS === 'web' ? 28 : 44
  const groups = useAtomValue(tabGroupsAtom)
  const activeGroupId = useAtomValue(activeGroupIdAtom)
  const activeTabId = useAtomValue(activeTabIdAtom)
  const switchGroup = useSwitchGroup()
  const createGroup = useCreateGroup()
  const updateGroup = useUpdateGroup()
  const setActiveIndex = useSetAtom(activeTabIndexAtom)
  const setMode = useSetAtom(appSwitcherModeAtom)
  const openInNewTab = useOpenInNewTab()
  const [collapsedGroups, setCollapsedGroups] = useAtom(collapsedWorkspaceGroupsAtom)
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
    onSelectContent?.()
  }

  const closeTab = useCloseWorkspaceTab()

  const addTab = () => openInNewTab(undefined, { autoRedirect: true })

  return (
    <SidebarDragProvider
      onExpandGroup={id => setCollapsedGroups(current => current.filter(groupId => groupId !== id))}
    >
      {(previewGroups, foldedGroupId) => (
        <Box
          className="flex-1 min-h-0 border-continuous overflow-hidden bg-light-grey border-r-[1px] border-border"
          style={{
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            width: WORKSPACE_SIDEBAR_WIDTH,
          }}
        >
          <HStack className="overflow-hidden border-continuous items-center pl-[20px] pr-[8px] py-[10px]">
            <Image
              source={require('~assets/images/icon.png')}
              style={{ width: 24, height: 24, borderRadius: 12 }}
              accessibilityLabel="Bible Strong"
            />
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
          <ScrollView
            style={{
              flex: 1,
              ...(Platform.OS === 'web' ? { scrollbarGutter: 'stable' } : {}),
            }}
            contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 8, gap: 8 }}
          >
            {[
              ...(previewGroups ?? groups).filter(group => group.isDefault),
              ...(previewGroups ?? groups).filter(group => !group.isDefault),
            ].map(group => {
              const collapsed =
                !group.isDefault &&
                (collapsedGroups.includes(group.id) || foldedGroupId === group.id)
              const groupColor = group.color || '#64748b'
              const groupBackground = resolveThemeColor(stylingTheme, groupColor)!
              const groupTextColor =
                Color(groupBackground).contrast(Color('#202124')) >=
                Color(groupBackground).contrast(Color('#ffffff'))
                  ? '#202124'
                  : '#ffffff'
              return (
                <SidebarDragGroup key={group.id} groupId={group.id} isDefault={group.isDefault}>
                  <Box className="overflow-hidden border-continuous gap-[4px]">
                    {!group.isDefault && (
                      <SidebarDragGroupHandle groupId={group.id}>
                        <SidebarHoverActions>
                          {showActions => (
                            <HStack
                              className="border-continuous overflow-visible rounded-[8px] items-center"
                              style={{
                                backgroundColor: resolveThemeColor(stylingTheme, groupColor),
                              }}
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
                                style={{ minHeight: rowHeight }}
                              >
                                <Text
                                  className="flex-[1] text-[12px] font-normal"
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
                                accessibilityLabel={t('workspace.groupActions', {
                                  name: group.name,
                                })}
                                onCreateGroup={() => createRef.current?.present()}
                                onGroupCreated={onSelectContent}
                                onEditGroup={() => setEditingGroup(group)}
                                onViewGroups={() => viewGroupsRef.current?.present()}
                              >
                                <Box
                                  className="overflow-hidden border-continuous items-center justify-center"
                                  style={{ width: actionSize, height: rowHeight }}
                                >
                                  <FeatherIcon
                                    name="more-horizontal"
                                    size={15}
                                    color={groupTextColor}
                                  />
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
                                style={{ width: actionSize, height: rowHeight }}
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
                      </SidebarDragGroupHandle>
                    )}
                    {!collapsed && (
                      <Box
                        className="overflow-hidden border-continuous gap-[0px]"
                        style={{
                          paddingLeft: group.isDefault ? 0 : 4,
                          marginLeft: group.isDefault ? 0 : 4,
                          borderLeftWidth: group.isDefault ? 0 : 2,
                          borderColor: resolveThemeColor(stylingTheme, groupColor),
                        }}
                      >
                        {group.isDefault && (
                          <SidebarHoverActions>
                            {showActions => (
                              <HStack
                                className="border-continuous overflow-visible items-center rounded-[8px]"
                                style={{
                                  backgroundColor: colorWithOpacity(
                                    resolveThemeColor(
                                      stylingTheme,
                                      activePage === 'home'
                                        ? 'reverse'
                                        : showActions
                                          ? 'default'
                                          : undefined
                                    ),
                                    activePage !== 'home' && showActions ? 0.05 : undefined
                                  ),
                                }}
                              >
                                <TouchableBox
                                  className="overflow-hidden border-continuous flex-[1] flex-row items-center px-[8px]"
                                  onPress={openHome}
                                  accessibilityRole="button"
                                  accessibilityLabel={t('Accueil')}
                                  accessibilityState={{ selected: activePage === 'home' }}
                                  style={{ minHeight: rowHeight }}
                                >
                                  <Box
                                    className="w-[20px] h-[20px] rounded-[5px] items-center justify-center shrink-0"
                                    style={{
                                      backgroundColor: colorWithOpacity(labelStyle.color, 0.12),
                                    }}
                                  >
                                    <FeatherIcon name="home" size={12} color={labelStyle.color} />
                                  </Box>
                                  <Text
                                    className="ml-[8px] flex-[1] text-[13px]"
                                    style={labelStyle}
                                    numberOfLines={1}
                                  >
                                    {t('Accueil')}
                                  </Text>
                                </TouchableBox>
                              </HStack>
                            )}
                          </SidebarHoverActions>
                        )}
                        {group.tabs.map((tab, index) => {
                          const iconColor = resolveThemeColor(
                            stylingTheme,
                            tabIconColorConfig[tab.type] || 'grey'
                          )
                          const selected =
                            isContentActive && group.id === activeGroupId && tab.id === activeTabId
                          return (
                            <SidebarDragTab key={tab.id} groupId={group.id} tabId={tab.id}>
                              <SidebarHoverActions>
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
                                      className="overflow-hidden border-continuous flex-[1] flex-row items-center px-[8px]"
                                      onPress={() => selectTab(group.id, index)}
                                      accessibilityRole="button"
                                      accessibilityLabel={tab.title}
                                      accessibilityState={{ selected }}
                                      style={{ minHeight: rowHeight }}
                                    >
                                      <Box
                                        className="w-[20px] h-[20px] rounded-[5px] items-center justify-center shrink-0"
                                        style={{
                                          backgroundColor: resolveUniverseColors(
                                            stylingTheme.colors,
                                            tab.type
                                          ).background,
                                        }}
                                      >
                                        <TabIcon type={tab.type} size={12} color={iconColor} />
                                      </Box>
                                      <Text
                                        className="ml-[8px] flex-[1] text-[13px]"
                                        style={labelStyle}
                                        numberOfLines={1}
                                      >
                                        {tab.title}
                                      </Text>
                                    </TouchableBox>
                                    {tab.isRemovable && (
                                      <TouchableBox
                                        className="overflow-hidden border-continuous items-center justify-center"
                                        style={[
                                          { width: actionSize, height: rowHeight },
                                          { opacity: selected || showActions ? 1 : 0 },
                                        ]}
                                        onPress={() => closeTab(group, tab.id)}
                                        accessibilityRole="button"
                                        accessibilityLabel={t('workspace.closeTab', {
                                          title: tab.title,
                                        })}
                                      >
                                        <FeatherIcon name="x" size={14} color="grey" />
                                      </TouchableBox>
                                    )}
                                  </HStack>
                                )}
                              </SidebarHoverActions>
                            </SidebarDragTab>
                          )
                        })}
                        {group.tabs.length === 0 && !group.isDefault && (
                          <TouchableBox
                            className="overflow-hidden border-continuous justify-center px-[8px]"
                            onPress={() =>
                              openInNewTab(undefined, { autoRedirect: true, groupId: group.id })
                            }
                            accessibilityRole="button"
                            style={{ minHeight: rowHeight }}
                          >
                            <Text className="text-[12px] text-grey">{t('tabs.create')}</Text>
                          </TouchableBox>
                        )}
                      </Box>
                    )}
                  </Box>
                </SidebarDragGroup>
              )
            })}
            {Platform.OS !== 'web' && groups.length < MAX_TAB_GROUPS && (
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
          <Box className="border-continuous overflow-hidden px-[12px] pt-[8px] pb-[8px] gap-[4px]">
            {Platform.OS === 'web' ? (
              <HStack className="gap-2" testID="workspace-create-actions">
                <TouchableBox
                  className="flex-1 flex-row items-center justify-center gap-[6px] rounded-[8px] border border-border min-h-[36px]"
                  onPress={addTab}
                  accessibilityRole="button"
                  accessibilityLabel={t('tabs.new')}
                >
                  <FeatherIcon name="plus" size={16} color="grey" />
                  <Text className="text-[13px]" style={labelStyle}>
                    {t('workspace.newTabShort')}
                  </Text>
                </TouchableBox>
                <TouchableBox
                  className="flex-1 flex-row items-center justify-center gap-[6px] rounded-[8px] border border-border min-h-[36px]"
                  onPress={() => createRef.current?.present()}
                  disabled={groups.length >= MAX_TAB_GROUPS}
                  accessibilityRole="button"
                  accessibilityLabel={t('tabs.newGroup')}
                  accessibilityState={{ disabled: groups.length >= MAX_TAB_GROUPS }}
                  style={{ opacity: groups.length >= MAX_TAB_GROUPS ? 0.4 : 1 }}
                >
                  <FeatherIcon name="folder-plus" size={16} color="grey" />
                  <Text className="text-[13px]" style={labelStyle}>
                    {t('workspace.newGroupShort')}
                  </Text>
                </TouchableBox>
              </HStack>
            ) : (
              <TouchableBox
                className="overflow-hidden border-continuous flex-row items-center justify-center rounded-[8px] bg-reverse"
                onPress={addTab}
                accessibilityRole="button"
                style={{ minHeight: rowHeight }}
              >
                <FeatherIcon name="plus" size={17} color="primary" />
                <Text className="ml-[8px] text-[13px]" style={labelStyle}>
                  {t('tabs.new')}
                </Text>
              </TouchableBox>
            )}
            <TouchableBox
              className="overflow-hidden border-continuous flex-row items-center px-[10px]"
              onPress={openMenu}
              accessibilityRole="button"
              accessibilityLabel={t('settings.settings')}
              accessibilityState={{ selected: activePage === 'settings' }}
              style={{
                minHeight: rowHeight,
                backgroundColor:
                  activePage === 'settings' ? stylingTheme.colors.reverse : undefined,
                borderRadius: 8,
              }}
            >
              <FeatherIcon name="settings" size={16} color="grey" />
              <Text className="ml-[8px] text-[13px]" style={labelStyle}>
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
      )}
    </SidebarDragProvider>
  )
}

export default WorkspaceSidebar
