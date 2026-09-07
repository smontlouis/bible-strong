import { usePathname, useRouter } from 'expo-router'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Platform } from 'react-native'
import { useTranslation } from 'react-i18next'
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
  const isWide = useResponsiveWorkspace()
  const [sidebarHidden, setSidebarHidden] = useState(false)
  // Web sheets render through a body portal, outside the workspace DOM tree.
  useEffect(() => {
    if (Platform.OS !== 'web') return
    document.documentElement.style.setProperty(
      '--workspace-content-left',
      `${isWide && !sidebarHidden ? WORKSPACE_SIDEBAR_WIDTH : 0}px`
    )
    return () => {
      document.documentElement.style.removeProperty('--workspace-content-left')
    }
  }, [isWide, sidebarHidden])

  const isWorkspace = pathname === '/'
  const visitPage = (page: 'home' | 'settings') => {
    if (pathname !== workspacePagePath[page]) router.push(workspacePagePath[page])
  }

  return (
    <HStack className="flex-1 bg-light-grey overflow-hidden">
      {isWide && !sidebarHidden && (
        <WorkspaceSidebar
          onCollapse={() => setSidebarHidden(true)}
          openHome={() => visitPage('home')}
          openMenu={() => visitPage('settings')}
          activePage={getWorkspacePageForPath(pathname)}
          isContentActive={isWorkspace}
          onSelectContent={() => {
            if (!isWorkspace) router.push('/')
          }}
        />
      )}
      <Box className="flex-1 min-w-0">
        {isWide && sidebarHidden && (
          <HStack className="bg-reverse border-b border-border">
            <TouchableBox
              className="items-center justify-center w-[44px] h-[44px]"
              onPress={() => setSidebarHidden(false)}
              accessibilityRole="button"
              accessibilityLabel={t('workspace.showSidebar')}
            >
              <FeatherIcon name="sidebar" size={18} />
            </TouchableBox>
          </HStack>
        )}
        <Box className="flex-1 min-h-0">
          {isWide && (
            <Box className="absolute inset-0" style={{ display: isWorkspace ? 'flex' : 'none' }}>
              <TabContextProvider>
                <CachedTabScreens />
                <SharedBibleDOM />
              </TabContextProvider>
            </Box>
          )}
          <Box className="flex-1" style={{ display: isWide && isWorkspace ? 'none' : 'flex' }}>
            {children}
          </Box>
        </Box>
      </Box>
    </HStack>
  )
}
