import { useEffect, useRef } from 'react'
import { useAtomValue } from 'jotai/react'
import { usePathname } from 'expo-router'
import { activeGroupAtom, appSwitcherModeAtom } from '~state/tabs'
import { trackAnalyticsEvent } from '~helpers/analytics'
import { compactWorkspaceDrawerAtom, createWorkspaceViewTracker } from './workspaceViewTracking'

export default function WorkspaceAnalytics() {
  const pathname = usePathname()
  const group = useAtomValue(activeGroupAtom)
  const mode = useAtomValue(appSwitcherModeAtom)
  const drawer = useAtomValue(compactWorkspaceDrawerAtom)
  const tab = group.tabs[group.activeTabIndex]
  const tabId = tab?.id
  const tabType = tab?.type
  const tracker = useRef<ReturnType<typeof createWorkspaceViewTracker> | null>(null)
  if (!tracker.current) {
    tracker.current = createWorkspaceViewTracker((name, parameters) => {
      void trackAnalyticsEvent(name, parameters)
    })
  }
  useEffect(() => {
    tracker.current?.(
      pathname !== '/'
        ? null
        : (drawer ?? (mode === 'view' && tabId && tabType ? { tabId, tabType } : null))
    )
  }, [pathname, drawer, mode, tabId, tabType])
  return null
}
