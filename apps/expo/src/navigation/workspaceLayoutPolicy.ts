export const WORKSPACE_ROUTE_PANEL_WIDTH = 500
export const WORKSPACE_MIN_MAIN_WIDTH = 640
export const WORKSPACE_REDOCK_MARGIN = 48

/** Evaluate docking with the sidebar present, even when manually hidden. This
 * avoids a feedback loop where hiding it immediately makes it eligible again. */
export function resolveWorkspaceLayout({
  width,
  sidebarWidth,
  panelOpen,
  sidebarHidden,
  wasDocked,
}: {
  width: number
  sidebarWidth: number
  panelOpen: boolean
  sidebarHidden: boolean
  wasDocked: boolean
}) {
  const withSidebar = Math.max(0, width - sidebarWidth)
  const candidatePanel = panelOpen ? Math.min(WORKSPACE_ROUTE_PANEL_WIDTH, withSidebar * 0.45) : 0
  const minimum = WORKSPACE_MIN_MAIN_WIDTH + (wasDocked ? 0 : WORKSPACE_REDOCK_MARGIN)
  const sidebarDocked = withSidebar - candidatePanel >= minimum
  const availableWidth = Math.max(0, width - (sidebarDocked && !sidebarHidden ? sidebarWidth : 0))
  const panelWidth = Math.min(WORKSPACE_ROUTE_PANEL_WIDTH, availableWidth * 0.45)
  return { sidebarDocked, panelWidth, mainWidth: availableWidth - (panelOpen ? panelWidth : 0) }
}
