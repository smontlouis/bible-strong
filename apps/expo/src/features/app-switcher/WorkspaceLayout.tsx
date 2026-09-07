import { finishPageTransition, navigateWithPageTransition } from '~navigation/pageTransition'
import { usePathname, useRouter } from 'expo-router'
import type { ReactNode } from 'react'
import { useEffect, useLayoutEffect, useState } from 'react'
import { useAtom } from 'jotai'
import { Platform, useWindowDimensions } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  useWorkspaceRoutePanel,
  WORKSPACE_DOCKED_SIDEBAR_BREAKPOINT,
  workspaceSidebarHiddenAtom,
} from '~navigation/useWorkspaceRoutePanel'
import Box, { HStack, TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import SharedBibleDOM from '~features/bible/SharedBibleDOM'
import CachedTabScreens from './CachedTabScreens'
import WorkspaceSidebar from './WorkspaceSidebar'
import { TabContextProvider } from './context/TabContext'
import { useResponsiveWorkspace, WORKSPACE_SIDEBAR_WIDTH } from './utils/useResponsiveWorkspace'
import { getWorkspacePageForPath, workspacePagePath } from './workspaceRoutes'

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const router = useRouter()
  const pathname = usePathname()
  useLayoutEffect(() => {
    finishPageTransition()
  }, [pathname])
  const isWide = useResponsiveWorkspace()
  const panel = useWorkspaceRoutePanel()
  const [sidebarHidden, setSidebarHidden] = useAtom(workspaceSidebarHiddenAtom)
  const [overlayOpen, setOverlayOpen] = useState(false)
  const { width } = useWindowDimensions()
  const overlayMode = Platform.OS === 'web' && width < WORKSPACE_DOCKED_SIDEBAR_BREAKPOINT
  const sidebarVisible = isWide && (overlayMode ? overlayOpen : !sidebarHidden)
  useEffect(() => {
    setOverlayOpen(false)
  }, [overlayMode, isWide, pathname])
  // Web sheets render through a body portal, outside the workspace DOM tree.
  useEffect(() => {
    if (Platform.OS !== 'web') return
    document.documentElement.style.setProperty(
      '--workspace-restore-inset',
      isWide && (overlayMode || sidebarHidden) ? '44px' : '0px'
    )
    document.documentElement.style.setProperty(
      '--workspace-content-left',
      `${isWide && !overlayMode && !sidebarHidden ? WORKSPACE_SIDEBAR_WIDTH : 0}px`
    )
    return () => {
      document.documentElement.style.removeProperty('--workspace-content-left')
      document.documentElement.style.removeProperty('--workspace-restore-inset')
    }
  }, [isWide, overlayMode, sidebarHidden, sidebarVisible])

  const isWorkspace = pathname === '/'
  const visitPage = (page: 'home' | 'settings') => {
    setOverlayOpen(false)
    if (pathname !== workspacePagePath[page])
      navigateWithPageTransition(workspacePagePath[page], () =>
        router.push(workspacePagePath[page])
      )
  }

  return (
    <HStack className="flex-1 bg-light-grey overflow-hidden">
      {isWide && (
        <Box
          testID="workspace-sidebar-motion"
          pointerEvents={sidebarVisible ? 'auto' : 'none'}
          aria-hidden={!sidebarVisible}
          style={{
            width: overlayMode || sidebarVisible ? WORKSPACE_SIDEBAR_WIDTH : 0,
            overflow: 'hidden',
            alignSelf: 'stretch',
            ...(overlayMode
              ? {
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  zIndex: 30,
                  transform: [{ translateX: sidebarVisible ? 0 : -WORKSPACE_SIDEBAR_WIDTH }],
                }
              : {}),
          }}
        >
          <Box
            testID="workspace-sidebar-inner"
            style={{
              width: WORKSPACE_SIDEBAR_WIDTH,
              flex: 1,
              transform: [
                { translateX: !overlayMode && !sidebarVisible ? -WORKSPACE_SIDEBAR_WIDTH : 0 },
              ],
            }}
          >
            <WorkspaceSidebar
              onCollapse={() => (overlayMode ? setOverlayOpen(false) : setSidebarHidden(true))}
              openHome={() => visitPage('home')}
              openMenu={() => visitPage('settings')}
              activePage={getWorkspacePageForPath(pathname)}
              isContentActive={isWorkspace}
              onSelectContent={() => {
                setOverlayOpen(false)
                if (!isWorkspace) router.push('/')
              }}
            />
          </Box>
        </Box>
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
      <Box testID="workspace-main-surface" className="flex-1 min-w-0">
        {isWide && !sidebarVisible && (
          <Box className="absolute left-0 top-0 z-20 bg-transparent">
            <TouchableBox
              className="items-center justify-center w-[44px] h-[54px]"
              onPress={() => (overlayMode ? setOverlayOpen(true) : setSidebarHidden(false))}
              accessibilityRole="button"
              accessibilityLabel={t('workspace.showSidebar')}
            >
              <FeatherIcon name="sidebar" size={18} />
            </TouchableBox>
          </Box>
        )}
        <Box className="flex-1 min-h-0">
          {isWide && (
            <Box
              testID="workspace-reader-motion"
              className="absolute inset-0"
              style={{
                display: isWorkspace || panel.showsStudy ? 'flex' : 'none',
                right: panel.open ? panel.reservedWidth : 0,
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
      </Box>
    </HStack>
  )
}
