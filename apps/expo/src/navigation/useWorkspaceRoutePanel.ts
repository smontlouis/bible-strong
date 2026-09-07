import { useRootNavigationState, useSegments } from 'expo-router'
import { atom, useAtomValue } from 'jotai'
import { Platform, useWindowDimensions } from 'react-native'

export const WORKSPACE_ROUTE_PANEL_WIDTH = 500
export const WORKSPACE_ROUTE_PANEL_BREAKPOINT = 768
export const WORKSPACE_DOCKED_SIDEBAR_BREAKPOINT = 1400
export const workspacePanelClosingAtom = atom(false)
export const workspaceSidebarHiddenAtom = atom(false)
const panelRoutes = new Set(['(timeline-search)', '(explore)', '(commentary)', 'strong'])

export function useWorkspaceRoutePanel() {
  const { width } = useWindowDimensions()
  const closing = useAtomValue(workspacePanelClosingAtom)
  const sidebarHidden = useAtomValue(workspaceSidebarHiddenAtom)
  const availableWidth =
    width - (width >= WORKSPACE_DOCKED_SIDEBAR_BREAKPOINT && !sidebarHidden ? 260 : 0)
  const panelWidth = Math.min(WORKSPACE_ROUTE_PANEL_WIDTH, availableWidth * 0.45)
  const segments = useSegments()
  const state = useRootNavigationState()
  const enabled = Platform.OS === 'web' && width >= WORKSPACE_ROUTE_PANEL_BREAKPOINT
  const open = enabled && panelRoutes.has(segments[0] as string)
  const workspaceState = state?.routes.find(route => route.name === '__root')?.state ?? state
  const routes = workspaceState?.routes.slice(0, (workspaceState.index ?? 0) + 1) ?? []
  const baseRoute = routes.findLast(route => !panelRoutes.has(route.name))
  const baseIndex = routes.findLastIndex(route => !panelRoutes.has(route.name))
  const closeTarget =
    baseIndex >= 0 && workspaceState?.key
      ? { key: workspaceState.key, count: routes.length - 1 - baseIndex }
      : undefined
  return {
    closeTarget,
    enabled,
    open,
    panelWidth,
    reservedWidth: closing ? 0 : panelWidth,
    showsStudy: open && (!baseRoute || baseRoute.name === 'index'),
  }
}
