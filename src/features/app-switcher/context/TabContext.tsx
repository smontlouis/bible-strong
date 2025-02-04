import React, { createContext, useContext } from 'react'
import { TabContextType } from './type'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TAB_ICON_SIZE } from '../utils/constants'

const TabContext = createContext<TabContextType>({
  isInTab: false,
})

export const TabContextProvider = ({
  children,
}: {
  children: React.ReactNode
}) => {
  const insets = useSafeAreaInsets()
  const isInTab = true
  const bottomBarHeight = TAB_ICON_SIZE + insets.bottom
  return (
    <TabContext.Provider value={{ isInTab: true }}>
      {children}
    </TabContext.Provider>
  )
}

export const useTabContext = () => {
  return useContext(TabContext)
}

export const useBottomBarHeightInTab = () => {
  const insets = useSafeAreaInsets()
  const { isInTab } = useTabContext()
  const bottomBarHeight = isInTab
    ? TAB_ICON_SIZE + insets.bottom
    : insets.bottom

  return { bottomBarHeight }
}
