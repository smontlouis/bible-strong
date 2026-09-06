import { useWindowDimensions } from 'react-native'

// Keep at least 740 px for the study surface when the navigation is expanded.
export const WORKSPACE_SIDEBAR_BREAKPOINT = 1000
export const WORKSPACE_SIDEBAR_WIDTH = 260

export const useResponsiveWorkspace = () =>
  useWindowDimensions().width >= WORKSPACE_SIDEBAR_BREAKPOINT
