import WorkspaceKeyboardShortcuts from './WorkspaceKeyboardShortcuts'
import GlobalCommandPalette from './commandPalette/GlobalCommandPalette'
import { finishPageTransition, navigateWithPageTransition } from '~navigation/pageTransition'
import { usePathname, useRouter } from 'expo-router'
import type { ReactNode } from 'react'
import { useEffect, useLayoutEffect, useState } from 'react'
import { useAtom, useSetAtom } from 'jotai'
import { Platform } from 'react-native'
import { cubicBezier, useReducedMotion } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import {
  useWorkspaceRoutePanel,
  workspaceSidebarDockedAtom,
  workspaceSidebarHiddenAtom,
} from '~navigation/useWorkspaceRoutePanel'
import Box, { AnimatedBox, HStack, TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import SharedBibleDOM from '~features/bible/SharedBibleDOM'
import CachedTabScreens from './CachedTabScreens'
import WorkspaceSidebar from './WorkspaceSidebar'
import { TabContextProvider } from './context/TabContext'
import { radii } from '~common/ui/surfaces'
import {
  useResponsiveWorkspace,
  WORKSPACE_FRAME_GAP,
  useWorkspaceSidebarWidth,
  workspaceSidebarVariant,
} from './utils/useResponsiveWorkspace'
import { getWorkspacePageForPath, workspacePagePath } from './workspaceRoutes'
import {
  WORKSPACE_SIDEBAR_BUTTON_HEIGHT,
  WORKSPACE_SIDEBAR_BUTTON_WIDTH,
  WorkspaceHeaderInsetProvider,
} from './workspaceHeaderInset'

// global.web.css animates the sidebar on the web; native runs the same motion through Reanimated.
const SidebarMotionBox = Platform.OS === 'web' ? Box : AnimatedBox

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const router = useRouter()
  const pathname = usePathname()
  const insets = useSafeAreaInsets()
  const sidebarWidth = useWorkspaceSidebarWidth()
  // A hidden sidebar still covers the left safe area, so the content's edge never moves.
  const collapsedSidebarWidth = insets.left
  const reduceMotion = useReducedMotion()
  const sidebarTransition =
    Platform.OS === 'web'
      ? {}
      : {
          transitionDuration: reduceMotion ? 0 : 240,
          transitionTimingFunction: cubicBezier(0.2, 0, 0, 1),
        }
  useLayoutEffect(() => {
    finishPageTransition()
  }, [pathname])
  const isWide = useResponsiveWorkspace()
  const panel = useWorkspaceRoutePanel()
  const [sidebarHidden, setSidebarHidden] = useAtom(workspaceSidebarHiddenAtom)
  const [overlayOpen, setOverlayOpen] = useState(false)
  const setSidebarDocked = useSetAtom(workspaceSidebarDockedAtom)
  const overlayMode = Platform.OS === 'web' && !panel.sidebarDocked
  useLayoutEffect(() => {
    if (Platform.OS === 'web') setSidebarDocked(panel.sidebarDocked)
  }, [panel.sidebarDocked, setSidebarDocked])
  const sidebarVisible = isWide && (overlayMode ? overlayOpen : !sidebarHidden)
  const sidebarBesideContent = isWide && !overlayMode && !sidebarHidden
  const inset = isWide && workspaceSidebarVariant === 'inset'
  // The inset panel keeps its gap on the left only when no sidebar sits beside it.
  const contentLeft = sidebarBesideContent ? sidebarWidth : inset ? WORKSPACE_FRAME_GAP : 0
  useEffect(() => {
    setOverlayOpen(false)
  }, [overlayMode, isWide, pathname])
  // Web sheets render through a body portal, outside the workspace DOM tree.
  useEffect(() => {
    if (Platform.OS !== 'web') return
    document.documentElement.style.setProperty('--workspace-content-left', `${contentLeft}px`)
    return () => {
      document.documentElement.style.removeProperty('--workspace-content-left')
    }
  }, [contentLeft])

  const isWorkspace = pathname === '/'
  // A form sheet opened over a tab leaves the tab on screen and selected in the sidebar.
  const basePath = panel.basePath ?? pathname
  const showsReader = basePath === '/' || panel.showsStudy
  const sheetOverReader = Platform.OS !== 'web' && basePath === '/' && !isWorkspace
  const visitPage = (page: 'home' | 'settings') => {
    setOverlayOpen(false)
    if (pathname !== workspacePagePath[page])
      navigateWithPageTransition(workspacePagePath[page], () =>
        router.push(workspacePagePath[page])
      )
  }

  const toggleSidebar = () => {
    if (overlayMode) setOverlayOpen(value => !value)
    else setSidebarHidden(value => !value)
  }

  return (
    <HStack className="flex-1 bg-canvas overflow-hidden">
      <GlobalCommandPalette />
      <WorkspaceKeyboardShortcuts
        toggleSidebar={() => {
          if (isWide) toggleSidebar()
        }}
      />
      {isWide && (
        <SidebarMotionBox
          testID="workspace-sidebar-motion"
          pointerEvents={sidebarVisible ? 'auto' : 'none'}
          aria-hidden={!sidebarVisible}
          style={{
            ...sidebarTransition,
            ...(Platform.OS === 'web' ? {} : { transitionProperty: 'width' }),
            width: overlayMode || sidebarVisible ? sidebarWidth : collapsedSidebarWidth,
            overflow: 'hidden',
            alignSelf: 'stretch',
            ...(overlayMode
              ? {
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  zIndex: 30,
                  transform: [{ translateX: sidebarVisible ? 0 : -sidebarWidth }],
                }
              : {}),
          }}
        >
          <SidebarMotionBox
            testID="workspace-sidebar-inner"
            style={{
              ...sidebarTransition,
              ...(Platform.OS === 'web' ? {} : { transitionProperty: 'transform' }),
              width: sidebarWidth,
              flex: 1,
              ...(workspaceSidebarVariant === 'floating' ? { padding: WORKSPACE_FRAME_GAP } : {}),
              transform: [{ translateX: !overlayMode && !sidebarVisible ? -sidebarWidth : 0 }],
            }}
          >
            <WorkspaceSidebar
              openHome={() => visitPage('home')}
              openMenu={() => visitPage('settings')}
              activePage={getWorkspacePageForPath(basePath)}
              isContentActive={showsReader}
              onSelectContent={() => {
                setOverlayOpen(false)
                if (!isWorkspace) router.push('/')
              }}
            />
          </SidebarMotionBox>
        </SidebarMotionBox>
      )}
      {isWide && overlayMode && (
        <TouchableBox
          testID="workspace-sidebar-backdrop"
          pointerEvents={sidebarVisible ? 'auto' : 'none'}
          aria-hidden={!sidebarVisible}
          style={{ opacity: sidebarVisible ? 1 : 0 }}
          className="absolute inset-0 z-20 bg-black/20"
          accessibilityRole="button"
          accessibilityLabel={t('Fermer')}
          onPress={() => setOverlayOpen(false)}
        />
      )}
      <Box
        testID="workspace-main-surface"
        className={
          inset
            ? 'flex-1 min-w-0 overflow-hidden bg-background border border-border'
            : 'flex-1 min-w-0'
        }
        style={
          inset
            ? {
                margin: WORKSPACE_FRAME_GAP,
                marginLeft: sidebarBesideContent ? 0 : WORKSPACE_FRAME_GAP,
                borderRadius: radii.control,
              }
            : undefined
        }
      >
        {/* Page headers leave this button's room, so it never moves their content. */}
        {isWide && (
          <Box className="absolute left-0 z-20 bg-transparent" style={{ top: insets.top }}>
            <TouchableBox
              testID="workspace-sidebar-toggle"
              className="items-center justify-center"
              style={{
                width: WORKSPACE_SIDEBAR_BUTTON_WIDTH,
                height: WORKSPACE_SIDEBAR_BUTTON_HEIGHT,
              }}
              onPress={toggleSidebar}
              accessibilityRole="button"
              accessibilityLabel={t(
                sidebarVisible ? 'workspace.hideSidebar' : 'workspace.showSidebar'
              )}
            >
              <FeatherIcon name="sidebar" size={18} />
            </TouchableBox>
          </Box>
        )}
        <WorkspaceHeaderInsetProvider value={isWide ? WORKSPACE_SIDEBAR_BUTTON_WIDTH : 0}>
          <Box className="flex-1 min-h-0">
            {isWide && (
              <Box
                testID="workspace-reader-motion"
                dataSet={Platform.OS === 'web' ? { assistantSurface: 'reader' } : undefined}
                className="absolute inset-0"
                style={{
                  display: showsReader ? 'flex' : 'none',
                  right: panel.open ? panel.reservedWidth : 0,
                  // The stack stays mounted to present the sheet, but its empty index screen
                  // must not cover the tab; UIKit presents the sheet above both.
                  zIndex: sheetOverReader ? 1 : undefined,
                }}
              >
                <TabContextProvider>
                  <CachedTabScreens />
                  <SharedBibleDOM />
                </TabContextProvider>
              </Box>
            )}
            <Box
              testID={panel.showsStudy ? 'workspace-panel-slot' : undefined}
              dataSet={
                Platform.OS === 'web'
                  ? { assistantSurface: panel.showsStudy ? 'panel' : 'reader' }
                  : undefined
              }
              className="flex-1 overflow-hidden"
              style={{
                display: isWide && isWorkspace ? 'none' : 'flex',
                ...(panel.showsStudy
                  ? {
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      right: 0,
                      width: panel.reservedWidth,
                    }
                  : undefined),
              }}
            >
              {children}
            </Box>
          </Box>
        </WorkspaceHeaderInsetProvider>
      </Box>
    </HStack>
  )
}
