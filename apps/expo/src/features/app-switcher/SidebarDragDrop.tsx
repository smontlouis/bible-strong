import Color from 'color'
import * as Haptics from 'expo-haptics'
import { useAtomValue, useStore } from 'jotai/react'
import { createContext, useContext, useRef, useState, type ReactNode, type Ref } from 'react'
import {
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import { runOnJS } from 'react-native-worklets'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { floatingShadow, radii } from '~common/ui/surfaces'
import { applySidebarDrop, type SidebarDrag, type SidebarDrop } from '~state/sidebarDragDrop'
import {
  activeGroupIdAtom,
  cachedTabIdsAtom,
  tabGroupsAtom,
  type TabGroup,
  type TabItem,
} from '~state/tabs'
import { resolveThemeColor } from '~themes/colorValues'
import { useTheme } from '~themes/ThemeProvider'
import { resolveUniverseColors } from '~themes/universeColors'
import TabIcon, { tabIconColorConfig } from './utils/getIconByTabType'

/** What the sidebar's list hands its scroll view while a row can be dragged (native only). */
export type SidebarScrollProps = {
  ref?: Ref<ScrollView>
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
  onContentSizeChange?: (width: number, height: number) => void
  scrollEventThrottle?: number
  scrollEnabled?: boolean
}
export type SidebarDragProviderProps = {
  children: (
    groups?: TabGroup[],
    /** True while a group is dragged: every group folds to its header. */
    foldGroups?: boolean,
    scrollProps?: SidebarScrollProps
  ) => ReactNode
  onExpandGroup: (id: string) => void
}
export type SidebarDragGroupProps = { children: ReactNode; groupId: string; isDefault?: boolean }
export type SidebarDragTabProps = {
  children: ReactNode
  groupId: string
  tabId: string
  title?: string
}

// A row is picked up after a long press, so a tap still opens it and a swipe still scrolls.
const LONG_PRESS = 350
const EDGE_ZONE = 56
const MAX_SCROLL_STEP = 12
const rowTransition = LinearTransition.duration(200)

type Row =
  | { kind: 'tab'; groupId: string; tabId: string }
  | { kind: 'group'; groupId: string }
  | { kind: 'header'; groupId: string }
type Session = { drag: SidebarDrag; key: string; left: number; width: number }
type DragApi = {
  session: Session | null
  /** The preview's top in the sidebar: the finger's height plus where the row was grabbed. */
  previewTop: SharedValue<number>
  /** 0 to 1: the preview fades and grows in on pickup, and back out on drop. */
  appear: SharedValue<number>
  register: (key: string, row: Row, view: View | null) => () => void
}
const DragContext = createContext<DragApi | null>(null)

function placeTab(
  draft: Record<string, string[]>,
  tabId: string,
  groupId: string,
  targetTabId: string | undefined,
  edge: 'before' | 'after'
) {
  const next = Object.fromEntries(
    Object.entries(draft).map(([id, ids]) => [id, ids.filter(other => other !== tabId)])
  )
  const ids = next[groupId] ?? []
  const index = targetTabId ? ids.indexOf(targetTabId) + (edge === 'after' ? 1 : 0) : 0
  next[groupId] = [...ids.slice(0, index), tabId, ...ids.slice(index)]
  return next
}
const sameLists = (a: Record<string, string[]>, b: Record<string, string[]>) =>
  Object.keys(a).every(id => a[id].join() === (b[id] ?? []).join())

function PreviewTab({ tab }: { tab: TabItem }) {
  const theme = useTheme()
  return (
    <Box className="flex-row items-center px-[8px] min-h-[44px]">
      <Box
        className="w-[20px] h-[20px] rounded-[4px] items-center justify-center"
        style={{ backgroundColor: resolveUniverseColors(theme.colors, tab.type).background }}
      >
        <TabIcon
          type={tab.type}
          size={12}
          color={resolveThemeColor(theme, tabIconColorConfig[tab.type] || 'grey')}
        />
      </Box>
      <Text className="ml-[8px] flex-1 text-[13px]" numberOfLines={1}>
        {tab.title}
      </Text>
    </Box>
  )
}
function DragPreview({ session, groups }: { session: Session; groups: TabGroup[] }) {
  const theme = useTheme()
  const { previewTop, appear } = useContext(DragContext)!
  const { drag } = session
  const style = useAnimatedStyle(() => ({
    opacity: appear.get(),
    transform: [{ translateY: previewTop.get() }, { scale: 0.94 + 0.06 * appear.get() }],
  }))
  // Looked up across all groups: after a drop into another group the tab has left its own.
  const tab =
    drag.kind === 'tab'
      ? groups.flatMap(item => item.tabs).find(item => item.id === drag.tabId)
      : undefined
  const group = groups.find(item => item.id === drag.groupId)
  if (!group || (drag.kind === 'tab' && !tab)) return null
  const groupColor = resolveThemeColor(theme, group.color || '#64748b')!
  const groupTextColor =
    Color(groupColor).contrast(Color('#202124')) >= Color(groupColor).contrast(Color('#ffffff'))
      ? '#202124'
      : '#ffffff'
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top: 0,
          left: session.left,
          width: session.width,
          borderRadius: radii.tile,
          // The dragged row floats above the sidebar: raised, with the one shared shadow.
          backgroundColor: theme.colors.surfaceRaised,
          overflow: 'hidden',
          zIndex: 10,
          ...floatingShadow,
        },
        style,
      ]}
    >
      {tab ? (
        <PreviewTab tab={tab} />
      ) : (
        <Box
          className="px-[8px] min-h-[44px] justify-center"
          style={{ backgroundColor: groupColor }}
        >
          <Text className="text-[12px]" style={{ color: groupTextColor }} numberOfLines={1}>
            {group.name}
          </Text>
        </Box>
      )}
    </Animated.View>
  )
}

export function SidebarDragProvider({ children, onExpandGroup }: SidebarDragProviderProps) {
  const store = useStore()
  const groups = useAtomValue(tabGroupsAtom)
  const previewTop = useSharedValue(0)
  const appear = useSharedValue(0)
  const reducedMotion = useReducedMotion()
  // The preview outlives the session by its fade out.
  const [preview, setPreview] = useState<Session | null>(null)
  const grabOffset = useSharedValue(0)
  const [session, setSession] = useState<Session | null>(null)
  const [draft, setDraft] = useState<Record<string, string[]> | null>(null)
  const [groupOrder, setGroupOrder] = useState<string[] | null>(null)
  const sessionRef = useRef<Session | null>(null)
  const draftRef = useRef<Record<string, string[]> | null>(null)
  const orderRef = useRef<string[] | null>(null)
  const rows = useRef(new Map<string, { row: Row; view: View }>())
  const rootRef = useRef<View>(null)
  const scrollRef = useRef<ScrollView>(null)
  const scrollOffset = useRef(0)
  const contentHeight = useRef(0)
  const scrollSpeed = useRef(0)
  const scrollTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastY = useRef(0)
  const expandedDuringDrag = useRef(new Set<string>())

  const allTabs = new Map(groups.flatMap(group => group.tabs.map(tab => [tab.id, tab] as const)))
  const orderedGroups = groupOrder
    ? [
        ...groups.filter(group => group.isDefault),
        ...groupOrder
          .map(id => groups.find(group => group.id === id))
          .filter((group): group is TabGroup => !!group),
      ]
    : groups
  const projectedGroups = draft
    ? orderedGroups.map(group => ({
        ...group,
        tabs: (draft[group.id] ?? group.tabs.map(tab => tab.id))
          .map(id => allTabs.get(id))
          .filter((tab): tab is TabItem => !!tab),
      }))
    : orderedGroups

  const setDraftLists = (next: Record<string, string[]>) => {
    const previous = draftRef.current
    const drag = sessionRef.current?.drag
    if (previous && sameLists(previous, next)) return
    if (previous && drag?.kind === 'tab') {
      const groupOf = (lists: Record<string, string[]>) =>
        Object.keys(lists).find(id => lists[id].includes(drag.tabId))
      if (groupOf(previous) !== groupOf(next)) void Haptics.selectionAsync()
    }
    draftRef.current = next
    setDraft(next)
  }
  const setOrder = (next: string[]) => {
    if (orderRef.current?.join() === next.join()) return
    orderRef.current = next
    setGroupOrder(next)
    void Haptics.selectionAsync()
  }

  // Finds the row under the finger and moves the dragged row there in the projected lists.
  const hitTest = (y: number) => {
    const current = sessionRef.current
    if (!current) return
    const { drag } = current
    for (const [key, { row, view }] of rows.current) {
      if (key === current.key) continue
      const rect = view.getBoundingClientRect()
      if (rect.height === 0 || y < rect.top || y >= rect.bottom) continue
      const edge = y < rect.top + rect.height / 2 ? 'before' : 'after'
      if (drag.kind === 'group') {
        if (row.kind !== 'group' || !orderRef.current) continue
        const without = orderRef.current.filter(id => id !== drag.groupId)
        const index = without.indexOf(row.groupId) + (edge === 'after' ? 1 : 0)
        setOrder([...without.slice(0, index), drag.groupId, ...without.slice(index)])
        return
      }
      if (!draftRef.current || row.kind === 'group') continue
      if (row.kind === 'header') {
        if (!expandedDuringDrag.current.has(row.groupId)) {
          expandedDuringDrag.current.add(row.groupId)
          onExpandGroup(row.groupId)
        }
        setDraftLists(placeTab(draftRef.current, drag.tabId, row.groupId, undefined, 'before'))
        return
      }
      setDraftLists(placeTab(draftRef.current, drag.tabId, row.groupId, row.tabId, edge))
      return
    }
  }

  const stopScrolling = () => {
    if (scrollTimer.current) clearInterval(scrollTimer.current)
    scrollTimer.current = null
  }
  // Near the list's top or bottom edge the list scrolls by itself, faster closer to the edge.
  const updateAutoScroll = (y: number) => {
    const list = scrollRef.current as unknown as View | null
    if (!list) return
    const rect = list.getBoundingClientRect()
    const fromTop = y - rect.top
    const fromBottom = rect.bottom - y
    scrollSpeed.current =
      fromTop < EDGE_ZONE
        ? -MAX_SCROLL_STEP * Math.min(1, (EDGE_ZONE - fromTop) / EDGE_ZONE)
        : fromBottom < EDGE_ZONE
          ? MAX_SCROLL_STEP * Math.min(1, (EDGE_ZONE - fromBottom) / EDGE_ZONE)
          : 0
    if (scrollSpeed.current === 0) return stopScrolling()
    if (scrollTimer.current) return
    scrollTimer.current = setInterval(() => {
      const maxOffset = Math.max(0, contentHeight.current - rect.height)
      const next = Math.max(0, Math.min(maxOffset, scrollOffset.current + scrollSpeed.current))
      if (next === scrollOffset.current) return
      scrollOffset.current = next
      scrollRef.current?.scrollTo({ y: next, animated: false })
      hitTest(lastY.current)
    }, 16)
  }

  // A long press picks up the tab or group header under the finger, if there is one.
  const start = (y: number) => {
    const root = rootRef.current
    const hit = [...rows.current.values()].find(({ row, view }) => {
      if (row.kind === 'group') return false
      const rect = view.getBoundingClientRect()
      return y >= rect.top && y < rect.bottom
    })
    if (!hit || !root) return
    const { row } = hit
    const drag: SidebarDrag =
      row.kind === 'tab'
        ? { kind: 'tab', groupId: row.groupId, tabId: row.tabId }
        : { kind: 'group', groupId: row.groupId }
    const key = row.kind === 'tab' ? `tab:${row.tabId}` : `group:${row.groupId}`
    const rect = hit.view.getBoundingClientRect()
    const rootRect = root.getBoundingClientRect()
    grabOffset.set(rect.top - rootRect.top - y)
    previewTop.set(rect.top - rootRect.top)
    const current = store.get(tabGroupsAtom)
    expandedDuringDrag.current.clear()
    draftRef.current = Object.fromEntries(
      current.map(group => [group.id, group.tabs.map(tab => tab.id)])
    )
    setDraft(draftRef.current)
    orderRef.current = current.filter(group => !group.isDefault).map(group => group.id)
    setGroupOrder(orderRef.current)
    sessionRef.current = {
      drag,
      key,
      left: rect.left - rootRect.left,
      width: rect.width,
    }
    setSession(sessionRef.current)
    setPreview(sessionRef.current)
    appear.set(
      withTiming(1, { duration: reducedMotion ? 0 : 160, easing: Easing.out(Easing.cubic) })
    )
    lastY.current = y
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
  }
  const move = (y: number) => {
    if (!sessionRef.current) return
    lastY.current = y
    hitTest(y)
    updateAutoScroll(y)
  }
  const finish = () => {
    stopScrolling()
    sessionRef.current = null
    draftRef.current = null
    orderRef.current = null
    setSession(null)
    appear.set(
      withTiming(0, { duration: reducedMotion ? 0 : 140 }, finished => {
        if (finished) runOnJS(setPreview)(null)
      })
    )
    setDraft(null)
    setGroupOrder(null)
  }
  const end = () => {
    const current = sessionRef.current
    if (!current) return
    const { drag } = current
    const currentGroups = store.get(tabGroupsAtom)
    let destination: SidebarDrop | undefined
    if (drag.kind === 'tab' && draftRef.current) {
      const entry = Object.entries(draftRef.current).find(([, ids]) => ids.includes(drag.tabId))
      if (entry) {
        const [groupId, ids] = entry
        const nextId = ids[ids.indexOf(drag.tabId) + 1]
        destination = { groupId, tabId: nextId, edge: nextId ? 'before' : 'inside' }
      }
    } else if (drag.kind === 'group' && orderRef.current) {
      const remaining = currentGroups.filter(group => !group.isDefault && group.id !== drag.groupId)
      const next = remaining[orderRef.current.indexOf(drag.groupId)]
      const last = remaining.at(-1)
      if (next || last)
        destination = { groupId: (next ?? last)!.id, edge: next ? 'before' : 'after' }
    }
    if (destination) {
      const result = applySidebarDrop(
        currentGroups,
        store.get(activeGroupIdAtom),
        drag,
        destination
      )
      if (result) {
        store.set(tabGroupsAtom, result.groups)
        if (drag.kind === 'tab' && drag.groupId !== destination.groupId) {
          store.set(
            cachedTabIdsAtom,
            store.get(cachedTabIdsAtom).filter(id => id !== drag.tabId)
          )
          onExpandGroup(destination.groupId)
        }
        store.set(activeGroupIdAtom, result.activeGroupId)
      }
    }
    finish()
  }
  const register = (key: string, row: Row, view: View | null) => {
    if (view) rows.current.set(key, { row, view })
    return () => {
      if (rows.current.get(key)?.view === view) rows.current.delete(key)
    }
  }

  const scrollProps: SidebarScrollProps = {
    ref: scrollRef,
    scrollEventThrottle: 16,
    scrollEnabled: !session,
    onScroll: event => {
      scrollOffset.current = event.nativeEvent.contentOffset.y
    },
    onContentSizeChange: (_width, height) => {
      contentHeight.current = height
    },
  }

  // One gesture for the whole sidebar: a row's own detector would unmount, and lose the drop,
  // as soon as the row moved into another group.
  const gesture = Gesture.Pan()
    .activateAfterLongPress(LONG_PRESS)
    .onStart(event => {
      runOnJS(start)(event.absoluteY)
    })
    .onUpdate(event => {
      previewTop.set(event.absoluteY + grabOffset.get())
      runOnJS(move)(event.absoluteY)
    })
    .onFinalize(() => {
      runOnJS(end)()
    })

  return (
    <DragContext.Provider value={{ session, previewTop, appear, register }}>
      <GestureDetector gesture={gesture}>
        <View ref={rootRef} collapsable={false} style={{ flex: 1 }}>
          {children(
            projectedGroups,
            // Moving a group folds them all, so the groups trade places as short headers.
            session?.drag.kind === 'group',
            scrollProps
          )}
          {preview && <DragPreview session={preview} groups={groups} />}
        </View>
      </GestureDetector>
    </DragContext.Provider>
  )
}

export function SidebarDragGroup({ children, groupId, isDefault }: SidebarDragGroupProps) {
  const { session, register } = useContext(DragContext)!
  const key = `group:${groupId}`
  const dragged = session?.key === key
  return (
    <Animated.View layout={session ? rowTransition : undefined}>
      <View
        collapsable={false}
        ref={view => (isDefault ? undefined : register(key, { kind: 'group', groupId }, view))}
        style={{ opacity: dragged ? 0.25 : 1 }}
      >
        {children}
      </View>
    </Animated.View>
  )
}
export function SidebarDragGroupHandle({ children, groupId }: SidebarDragGroupProps) {
  const { register } = useContext(DragContext)!
  return (
    <View
      collapsable={false}
      ref={view => register(`header:${groupId}`, { kind: 'header', groupId }, view)}
    >
      {children}
    </View>
  )
}
export function SidebarDragTab({ children, groupId, tabId }: SidebarDragTabProps) {
  const { session, register } = useContext(DragContext)!
  const key = `tab:${tabId}`
  return (
    <Animated.View layout={session ? rowTransition : undefined}>
      <View
        collapsable={false}
        ref={view => register(key, { kind: 'tab', groupId, tabId }, view)}
        style={{ opacity: session?.key === key ? 0.2 : 1 }}
      >
        {children}
      </View>
    </Animated.View>
  )
}
