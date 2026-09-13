import { webFontFamily } from '~helpers/webFontFamily'
import { resolveUniverseColors } from '~themes/universeColors'
import TabIcon from './utils/getIconByTabType'
import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useRef, useState } from 'react'
import { useAtomValue, useStore } from 'jotai/react'
import { useRouter, usePathname } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { activeGroupAtom, activeTabIdAtom, tabGroupsAtom, type TabItem } from '~state/tabs'
import { useSwitchGroup } from '~state/tabGroups'
import { useTheme } from '~themes/ThemeProvider'
import { useOpenInNewTab } from './utils/useOpenInNewTab'
import { useCloseWorkspaceTab } from './utils/useCloseWorkspaceTab'
import { useSlideNewTab } from './utils/useSlideNewTab'
import { commandPaletteOpenAtom, recentCommandTabIdsAtom } from './commandPalette/state'
import { cycleIndex, isEditingTarget, workspaceShortcut } from './keyboardShortcuts'
import './commandPalette/command-palette.css'

type Candidate = {
  id: string
  groupId: string
  title: string
  groupName: string
  type: TabItem['type']
}
type Session = { tabs: Candidate[]; index: number }

export default function WorkspaceKeyboardShortcuts({
  toggleSidebar,
}: {
  toggleSidebar: () => void
}) {
  const { t } = useTranslation()
  const theme = useTheme()
  const store = useStore()
  const router = useRouter()
  const pathname = usePathname()
  const groups = useAtomValue(tabGroupsAtom)
  const switchGroup = useSwitchGroup()
  const { triggerSlideNewTab } = useSlideNewTab()
  const newTab = useOpenInNewTab()
  const closeTab = useCloseWorkspaceTab()
  const [session, setSession] = useState<Session | null>(null)
  const sessionRef = useRef<Session | null>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const updateSession = (value: Session | null) => {
    sessionRef.current = value
    setSession(value)
  }
  const select = (candidate: Candidate | undefined) => {
    updateSession(null)
    if (
      !candidate ||
      !store
        .get(tabGroupsAtom)
        .some(
          group => group.id === candidate.groupId && group.tabs.some(tab => tab.id === candidate.id)
        )
    )
      return
    returnFocus.current = null
    switchGroup(candidate.groupId)
    router.dismissTo('/')
    triggerSlideNewTab(candidate.id)
  }
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [session?.index])
  useEffect(() => {
    if (
      sessionRef.current &&
      sessionRef.current.tabs.some(
        candidate => !groups.some(group => group.tabs.some(tab => tab.id === candidate.id))
      )
    )
      updateSession(null)
  }, [groups])
  useEffect(() => {
    const mac = /Mac|iPhone|iPad/.test(navigator.platform)
    const down = (event: KeyboardEvent) => {
      const current = sessionRef.current
      const shortcut = workspaceShortcut(event, mac)
      if (current) {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          updateSession(null)
          return
        }
        if (event.key === 'Enter') {
          event.preventDefault()
          select(current.tabs[current.index])
          return
        }
        const direction =
          shortcut === 'switcher'
            ? event.shiftKey
              ? -1
              : 1
            : event.key === 'ArrowDown'
              ? 1
              : event.key === 'ArrowUp'
                ? -1
                : 0
        if (direction) {
          event.preventDefault()
          event.stopPropagation()
          if (!event.repeat)
            updateSession({
              ...current,
              index: cycleIndex(current.index, direction, current.tabs.length),
            })
        }
        return
      }
      if (
        !shortcut ||
        event.defaultPrevented ||
        isEditingTarget(event.target) ||
        store.get(commandPaletteOpenAtom)
      )
        return
      // Do not operate on the workspace underneath another modal or open menu.
      if (
        document.querySelector(
          '[role="dialog"], [role="alertdialog"], [role="menu"], [aria-modal="true"]'
        )
      )
        return
      event.preventDefault()
      event.stopPropagation()
      if (event.repeat) return
      const group = store.get(activeGroupAtom)
      if (shortcut === 'new') newTab(undefined, { autoRedirect: true })
      else if (shortcut === 'close' && pathname === '/') {
        const tab = group.tabs[group.activeTabIndex]
        if (tab) closeTab(group, tab.id)
      } else if (shortcut === 'sidebar') toggleSidebar()
      else if (shortcut === 'next' || shortcut === 'previous') {
        const tabs = store.get(tabGroupsAtom).flatMap(group =>
          group.tabs.map(tab => ({
            id: tab.id,
            type: tab.type,
            title: tab.title,
            groupId: group.id,
            groupName: group.name,
          }))
        )
        const index = tabs.findIndex(tab => tab.id === store.get(activeTabIdAtom))
        select(tabs[cycleIndex(index, shortcut === 'next' ? 1 : -1, tabs.length)])
      } else if (shortcut === 'switcher') {
        const activeId = store.get(activeTabIdAtom)
        const recent = store.get(recentCommandTabIdsAtom)
        const tabs = store.get(tabGroupsAtom).flatMap(group =>
          group.tabs
            .filter(tab => tab.type !== 'new')
            .map(tab => ({
              id: tab.id,
              type: tab.type,
              title: tab.title,
              groupId: group.id,
              groupName: group.name,
            }))
        )
        const rank = (id: string) =>
          id === activeId ? -1 : recent.includes(id) ? recent.indexOf(id) : recent.length
        tabs.sort((a, b) => rank(a.id) - rank(b.id))
        if (!tabs.length) return
        returnFocus.current =
          document.activeElement instanceof HTMLElement ? document.activeElement : null
        const activeIndex = tabs.findIndex(tab => tab.id === activeId)
        updateSession({
          tabs,
          index:
            activeIndex < 0
              ? event.shiftKey
                ? tabs.length - 1
                : 0
              : cycleIndex(activeIndex, event.shiftKey ? -1 : 1, tabs.length),
        })
      }
    }
    const up = (event: KeyboardEvent) => {
      const current = sessionRef.current
      if (current && event.key === (mac ? 'Control' : 'Alt')) {
        event.preventDefault()
        select(current.tabs[current.index])
      }
    }
    const cancel = () => updateSession(null)
    const visibility = () => {
      if (document.hidden) cancel()
    }
    document.addEventListener('keydown', down, true)
    document.addEventListener('keyup', up, true)
    window.addEventListener('blur', cancel)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      document.removeEventListener('keydown', down, true)
      document.removeEventListener('keyup', up, true)
      window.removeEventListener('blur', cancel)
      document.removeEventListener('visibilitychange', visibility)
    }
  })
  return (
    <Dialog.Root
      open={!!session}
      onOpenChange={open => {
        if (!open) updateSession(null)
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="bs-command-overlay" />
        <Dialog.Content
          className="bs-command-dialog bs-tab-switcher"
          style={{
            background: theme.colors.reverse,
            color: theme.colors.default,
            fontFamily: webFontFamily(theme.fontFamily.text),
          }}
          onOpenAutoFocus={event => {
            event.preventDefault()
            listRef.current?.focus()
          }}
          onCloseAutoFocus={event => {
            event.preventDefault()
            if (returnFocus.current?.isConnected) returnFocus.current.focus()
          }}
        >
          <Dialog.Title style={{ fontFamily: webFontFamily(theme.fontFamily.title) }}>
            {t('hotkeys.recentTabs')}
          </Dialog.Title>
          <Dialog.Description>{t('hotkeys.switcherHint')}</Dialog.Description>
          <div
            ref={listRef}
            role="listbox"
            tabIndex={-1}
            aria-label={t('hotkeys.recentTabs')}
            aria-activedescendant={session ? `recent-tab-${session.index}` : undefined}
          >
            {session?.tabs.map((tab, index) => (
              <div
                role="option"
                id={`recent-tab-${index}`}
                key={tab.id}
                aria-selected={index === session.index}
                style={{
                  background: index === session.index ? theme.colors.lightPrimary : undefined,
                }}
                onMouseMove={() => updateSession({ ...session, index })}
                onClick={() => select(tab)}
              >
                <span
                  className="bs-tab-switcher-icon"
                  aria-hidden="true"
                  style={{ background: resolveUniverseColors(theme.colors, tab.type).background }}
                >
                  <TabIcon type={tab.type} size={16} />
                </span>
                <span className="bs-tab-switcher-title">{tab.title}</span>
                <small>{tab.groupName}</small>
              </div>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
