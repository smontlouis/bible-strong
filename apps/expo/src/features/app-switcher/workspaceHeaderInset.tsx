import { createContext, useContext, type ReactNode } from 'react'

/** Width of the sidebar button set at the left of a wide workspace's page header. */
export const WORKSPACE_SIDEBAR_BUTTON_WIDTH = 44
export const WORKSPACE_SIDEBAR_BUTTON_HEIGHT = 54

const WorkspaceHeaderInsetContext = createContext(0)

export const WorkspaceHeaderInsetProvider = WorkspaceHeaderInsetContext.Provider

/** Room a page header leaves at its left for the sidebar button. */
export const useWorkspaceHeaderInset = () => useContext(WorkspaceHeaderInsetContext)

/** Sheets and side panels open away from the sidebar button. */
export const WithoutWorkspaceHeaderInset = ({ children }: { children: ReactNode }) => (
  <WorkspaceHeaderInsetContext.Provider value={0}>{children}</WorkspaceHeaderInsetContext.Provider>
)
