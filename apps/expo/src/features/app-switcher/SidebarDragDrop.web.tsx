import { createContext, useContext, useRef, useState, type RefCallback } from 'react'
import {
  DragDropProvider,
  DragOverlay,
  useDroppable,
  PointerSensor,
  KeyboardSensor,
} from '@dnd-kit/react'
import { useSortable, isSortable } from '@dnd-kit/react/sortable'
import { PointerActivationConstraints } from '@dnd-kit/dom'
import { pointerIntersection } from '@dnd-kit/collision'
import { move } from '@dnd-kit/helpers'
import { useAtomValue, useStore } from 'jotai/react'
import { useReducedMotion } from 'motion/react'
import {
  activeGroupIdAtom,
  cachedTabIdsAtom,
  tabGroupsAtom,
  type TabGroup,
  type TabItem,
} from '~state/tabs'
import { applySidebarDrop, type SidebarDrag, type SidebarDrop } from '~state/sidebarDragDrop'
import { useTheme } from '~themes/ThemeProvider'
import { colorWithOpacity, resolveThemeColor } from '~themes/colorValues'
import Color from 'color'
import { webFontFamily } from '~helpers/webFontFamily'
import TabIcon, { tabIconColorConfig } from './utils/getIconByTabType'
import type {
  SidebarDragGroupProps,
  SidebarDragProviderProps,
  SidebarDragTabProps,
} from './SidebarDragDrop'

type Snapshot = { drag: SidebarDrag; group: TabGroup; width: number }
const DragContext = createContext<{ groups: TabGroup[]; snapshot: Snapshot | null } | null>(null)
const GroupHandleContext = createContext<RefCallback<Element> | undefined>(undefined)
const sensors = [
  PointerSensor.configure({
    activationConstraints: [new PointerActivationConstraints.Distance({ value: 6 })],
    preventActivation: (event, source) => {
      if (!(event.target instanceof Element)) return true
      if (event.target.closest('input, textarea, select, [contenteditable="true"]')) return true
      const button = event.target.closest('button, [role="button"]')
      const handle = source.handle ?? source.element
      return !!button && button !== handle?.querySelector('button, [role="button"]')
    },
  }),
  KeyboardSensor,
]

function PreviewTab({ tab }: { tab: TabItem }) {
  const theme = useTheme()
  const color = resolveThemeColor(
    theme,
    tab.type === 'bible' ? 'color1' : tabIconColorConfig[tab.type] || 'grey'
  )
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 32,
        padding: '0 8px',
        fontSize: 13,
      }}
    >
      <span
        style={{
          width: 20,
          height: 20,
          borderRadius: 5,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: colorWithOpacity(color, 0.12),
        }}
      >
        <TabIcon type={tab.type} size={12} color={color} />
      </span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {tab.title}
      </span>
    </div>
  )
}
function DragPreview({ snapshot }: { snapshot: Snapshot }) {
  const theme = useTheme()
  const { drag, group, width } = snapshot
  const groupColor = resolveThemeColor(theme, group.color || '#64748b')!
  const groupTextColor =
    Color(groupColor).contrast(Color('#202124')) >= Color(groupColor).contrast(Color('#ffffff'))
      ? '#202124'
      : '#ffffff'
  return (
    <div
      data-sidebar-drag-preview
      style={{
        width,
        borderRadius: 8,
        background: theme.colors.lightGrey,
        color: theme.colors.default,
        fontFamily: webFontFamily(theme.fontFamily.text),
        boxShadow: '0 8px 24px #0003',
        border: `1px solid ${theme.colors.border}`,
        boxSizing: 'border-box',
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      {drag.kind === 'tab' ? (
        <PreviewTab tab={group.tabs.find(tab => tab.id === drag.tabId)!} />
      ) : (
        <>
          <div
            style={{
              background: groupColor,
              color: groupTextColor,
              padding: '6px 8px',
              fontSize: 12,
            }}
          >
            {group.name}
          </div>
        </>
      )}
    </div>
  )
}

export function SidebarDragProvider({ children, onExpandGroup }: SidebarDragProviderProps) {
  const store = useStore()
  const groups = useAtomValue(tabGroupsAtom)
  const reducedMotion = useReducedMotion()
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [foldedGroupId, setFoldedGroupId] = useState<string>()
  const [draft, setDraft] = useState<Record<string, string[]> | null>(null)
  const [groupOrder, setGroupOrder] = useState<string[] | null>(null)
  const groupOrderRef = useRef<string[] | null>(null)
  const draftRef = useRef<Record<string, string[]> | null>(null)
  const sourceRef = useRef<SidebarDrag | null>(null)
  const expandedDuringDrag = useRef(new Set<string>())
  const suppressClickUntil = useRef(0)
  const allTabs = new Map(groups.flatMap(group => group.tabs.map(tab => [tab.id, tab] as const)))
  const orderedGroups = groupOrder
    ? [
        ...groups.filter(group => group.isDefault),
        ...groupOrder
          .map(id => groups.find(group => `sort-group:${group.id}` === id))
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
  const finish = () => {
    setFoldedGroupId(undefined)
    setGroupOrder(null)
    groupOrderRef.current = null
    setDraft(null)
    draftRef.current = null
    sourceRef.current = null
    suppressClickUntil.current = Date.now() + 250
  }
  return (
    <DragDropProvider
      sensors={sensors}
      onDragStart={event => {
        const source = event.operation.source
        if (!source) return
        const drag = source.data.drag as SidebarDrag
        const group = store.get(tabGroupsAtom).find(group => group.id === drag.groupId)
        if (!group) return
        sourceRef.current = drag
        setFoldedGroupId(drag.kind === 'group' ? drag.groupId : undefined)
        expandedDuringDrag.current.clear()
        groupOrderRef.current = store
          .get(tabGroupsAtom)
          .filter(group => !group.isDefault)
          .map(group => `sort-group:${group.id}`)
        setGroupOrder(groupOrderRef.current)
        const next = Object.fromEntries(
          store.get(tabGroupsAtom).map(group => [group.id, group.tabs.map(tab => tab.id)])
        )
        draftRef.current = next
        setDraft(next)
        setSnapshot({
          drag,
          group,
          width: source.element?.getBoundingClientRect().width ?? 224,
        })
      }}
      onDragOver={event => {
        if (sourceRef.current?.kind === 'group' && groupOrderRef.current) {
          const next = move(groupOrderRef.current, event)
          groupOrderRef.current = next
          setGroupOrder(next)
          return
        }
        if (sourceRef.current?.kind !== 'tab' || !draftRef.current) return
        const target = event.operation.target
        if (target?.type === 'container' && !expandedDuringDrag.current.has(String(target.id))) {
          expandedDuringDrag.current.add(String(target.id))
          onExpandGroup(String(target.id))
        }
        const next = move(draftRef.current, event)
        draftRef.current = next
        setDraft(next)
      }}
      onDragEnd={event => {
        const drag = sourceRef.current
        const { source, target } = event.operation
        if (!event.canceled && drag && source && target) {
          const currentGroups = store.get(tabGroupsAtom)
          let destination: SidebarDrop | undefined
          if (drag.kind === 'tab' && draftRef.current) {
            const entry = Object.entries(draftRef.current).find(([, ids]) =>
              ids.includes(drag.tabId)
            )
            if (entry) {
              const [groupId, ids] = entry
              const index = ids.indexOf(drag.tabId)
              const nextId = ids[index + 1]
              destination = { groupId, tabId: nextId, edge: nextId ? 'before' : 'inside' }
            }
          } else if (drag.kind === 'group' && isSortable(source)) {
            const remaining = currentGroups.filter(
              group => !group.isDefault && group.id !== drag.groupId
            )
            const index =
              groupOrderRef.current?.indexOf(`sort-group:${drag.groupId}`) ?? source.index
            const next = remaining[index]
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
        }
        finish()
      }}
    >
      <DragContext.Provider value={{ groups: projectedGroups, snapshot }}>
        <div
          style={{ display: 'contents' }}
          onClickCapture={event => {
            if (Date.now() < suppressClickUntil.current) {
              event.preventDefault()
              event.stopPropagation()
            }
          }}
        >
          {children(projectedGroups, foldedGroupId)}
        </div>
        <DragOverlay
          dropAnimation={{ duration: reducedMotion ? 0 : 200, easing: 'ease-out' }}
          style={{ zIndex: 3000 }}
        >
          {source => (source && snapshot ? <DragPreview snapshot={snapshot} /> : null)}
        </DragOverlay>
      </DragContext.Provider>
    </DragDropProvider>
  )
}

export function SidebarDragGroup({ children, groupId, isDefault }: SidebarDragGroupProps) {
  const context = useContext(DragContext)!
  const reducedMotion = useReducedMotion()
  const index = context.groups
    .filter(group => !group.isDefault)
    .findIndex(group => group.id === groupId)
  const sortable = useSortable({
    id: `sort-group:${groupId}`,
    index,
    group: 'sidebar-groups',
    type: 'group',
    accept: 'group',
    disabled: !!isDefault,
    data: { drag: { kind: 'group', groupId } },
    transition: { duration: reducedMotion ? 0 : 200 },
  })
  const drop = useDroppable({
    id: groupId,
    type: 'container',
    accept: 'tab',
    collisionPriority: 1,
    collisionDetector: pointerIntersection,
  })
  return (
    <GroupHandleContext.Provider value={sortable.handleRef}>
      <div
        ref={element => {
          sortable.ref(element)
          drop.ref(element)
        }}
        data-sidebar-drop-group={groupId}
        style={{ flexShrink: 0, opacity: sortable.isDragSource ? 0.25 : 1 }}
      >
        {children}
      </div>
    </GroupHandleContext.Provider>
  )
}
export function SidebarDragGroupHandle({ children, groupId }: SidebarDragGroupProps) {
  const handle = useContext(GroupHandleContext)
  return (
    <div
      ref={handle}
      data-sidebar-drag-group={groupId}
      style={{ cursor: 'grab', touchAction: 'none' }}
      tabIndex={0}
    >
      {children}
    </div>
  )
}
export function SidebarDragTab({ children, groupId, tabId }: SidebarDragTabProps) {
  const context = useContext(DragContext)!
  const reducedMotion = useReducedMotion()
  const index =
    context.groups.find(group => group.id === groupId)?.tabs.findIndex(tab => tab.id === tabId) ?? 0
  const sortable = useSortable({
    id: tabId,
    index,
    group: groupId,
    type: 'tab',
    accept: 'tab',
    data: { drag: { kind: 'tab', groupId, tabId } },
    transition: { duration: reducedMotion ? 0 : 200 },
  })
  return (
    <div
      ref={sortable.ref}
      data-sidebar-drag-tab={tabId}
      style={{ opacity: sortable.isDragSource ? 0.2 : 1, cursor: 'grab', touchAction: 'none' }}
      tabIndex={0}
    >
      {children}
    </div>
  )
}
