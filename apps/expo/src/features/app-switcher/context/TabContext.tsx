import React, { createContext, useContext } from 'react'
import { TabContextType } from './type'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useResponsiveWorkspace } from '../utils/useResponsiveWorkspace'
import { TAB_ICON_SIZE } from '../utils/constants'
import { useBibleAudioMiniPlayerHeight } from '~features/bible-audio/ui/useBibleAudioMiniPlayerHeight'

const TabContext = createContext<TabContextType>({
  isInTab: false,
})

export const TabContextProvider = ({ children }: { children: React.ReactNode }) => {
  return <TabContext.Provider value={{ isInTab: true }}>{children}</TabContext.Provider>
}

export const useTabContext = () => {
  return useContext(TabContext)
}

export const useBottomBarHeightInTab = () => {
  const insets = useSafeAreaInsets()
  const { isInTab } = useTabContext()
  const isWide = useResponsiveWorkspace()
  const hasTabBar = isInTab && !isWide
  // The small audio player sits in the tab bar, which grows by its height.
  const audioMiniPlayerHeight = useBibleAudioMiniPlayerHeight()
  const miniPlayerHeight = hasTabBar ? audioMiniPlayerHeight : 0
  const bottomBarHeight = hasTabBar
    ? TAB_ICON_SIZE + miniPlayerHeight + insets.bottom
    : insets.bottom

  return { bottomBarHeight, miniPlayerHeight }
}
