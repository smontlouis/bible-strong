import { useRootNavigationState, useSegments } from 'expo-router'
import { atom, useAtomValue } from 'jotai'
import { Platform, useWindowDimensions } from 'react-native'
import {
  WORKSPACE_FRAME_GAP,
  WORKSPACE_SIDEBAR_WIDTH,
  workspaceSidebarVariant,
} from '~features/app-switcher/utils/useResponsiveWorkspace'
import { resolveWorkspaceLayout } from './workspaceLayoutPolicy'
export { WORKSPACE_ROUTE_PANEL_WIDTH } from './workspaceLayoutPolicy'

export const WORKSPACE_ROUTE_PANEL_BREAKPOINT = 768
export const workspaceSidebarDockedAtom = atom(true)
export const workspacePanelClosingAtom = atom(false)
export const workspaceSidebarHiddenAtom = atom(false)
const panelRoutes = new Set(['(timeline-search)', '(explore)', '(commentary)', 'strong'])

export function useWorkspaceRoutePanel() {
  const { width } = useWindowDimensions()
  const closing = useAtomValue(workspacePanelClosingAtom)
  const sidebarHidden = useAtomValue(workspaceSidebarHiddenAtom)
  const wasDocked = useAtomValue(workspaceSidebarDockedAtom)
  const segments = useSegments()
  const state = useRootNavigationState()
  const enabled = Platform.OS === 'web' && width >= WORKSPACE_ROUTE_PANEL_BREAKPOINT
  const open = enabled && panelRoutes.has(segments[0] as string)
  const { sidebarDocked, panelWidth } = resolveWorkspaceLayout({
    // The inset panel gives up its frame gap on both sides.
    width: workspaceSidebarVariant === 'inset' ? width - 2 * WORKSPACE_FRAME_GAP : width,
    sidebarWidth: WORKSPACE_SIDEBAR_WIDTH,
    panelOpen: open,
    sidebarHidden,
    wasDocked,
  })
  const workspaceState = state?.routes.find(route => route.name === '__root')?.state ?? state
  const routes = workspaceState?.routes.slice(0, (workspaceState.index ?? 0) + 1) ?? []
  const baseRoute = routes.findLast(route => !panelRoutes.has(route.name))
  const baseIndex = routes.findLastIndex(route => !panelRoutes.has(route.name))
  const closeTarget =
    baseIndex >= 0 && workspaceState?.key
      ? { key: workspaceState.key, count: routes.length - 1 - baseIndex }
      : undefined
  // Under a sheet the page that stays on screen is the base route, not the sheet's own path.
  const basePath =
    baseRoute && baseIndex < routes.length - 1
      ? baseRoute.name === 'index'
        ? '/'
        : `/${baseRoute.name}`
      : undefined
  return {
    basePath,
    sidebarDocked: Platform.OS === 'web' ? sidebarDocked : true,
    closeTarget,
    enabled,
    open,
    panelWidth,
    reservedWidth: closing ? 0 : panelWidth,
    showsStudy: open && (!baseRoute || baseRoute.name === 'index'),
  }
}
