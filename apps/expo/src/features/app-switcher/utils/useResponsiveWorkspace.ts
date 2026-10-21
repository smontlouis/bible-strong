import { Platform, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

// Share the tablet layout across platforms; narrower windows use mobile navigation.
export const WORKSPACE_SIDEBAR_BREAKPOINT = 768
export const WORKSPACE_SIDEBAR_WIDTH = 260

/**
 * How the web workspace frames its sidebar and main surface:
 * - `inset`: the main surface is a rounded panel set into the sidebar's ground.
 * - `floating`: the sidebar is a rounded card floating beside a flat main surface.
 * - `sidebar`: a flat sidebar split from the main surface by a hairline.
 */
export type WorkspaceSidebarVariant = 'inset' | 'floating' | 'sidebar'
export const WORKSPACE_SIDEBAR_VARIANT: WorkspaceSidebarVariant = 'inset'
/** Gap between the window edge and a framed surface (inset panel or floating sidebar). */
export const WORKSPACE_FRAME_GAP = 8

/** Native tablets keep the flat sidebar. */
export const workspaceSidebarVariant: WorkspaceSidebarVariant =
  Platform.OS === 'web' ? WORKSPACE_SIDEBAR_VARIANT : 'sidebar'

export const useResponsiveWorkspace = () =>
  useWindowDimensions().width >= WORKSPACE_SIDEBAR_BREAKPOINT

/** The sidebar also covers the left safe area, under a landscape iPhone's camera. */
export const useWorkspaceSidebarWidth = () => WORKSPACE_SIDEBAR_WIDTH + useSafeAreaInsets().left
