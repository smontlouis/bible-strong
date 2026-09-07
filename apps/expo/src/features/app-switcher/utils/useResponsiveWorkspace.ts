import { useWindowDimensions } from 'react-native'

// Share the tablet layout across platforms; narrower windows use mobile navigation.
export const WORKSPACE_SIDEBAR_BREAKPOINT = 768
export const WORKSPACE_SIDEBAR_WIDTH = 260

export const useResponsiveWorkspace = () =>
  useWindowDimensions().width >= WORKSPACE_SIDEBAR_BREAKPOINT
