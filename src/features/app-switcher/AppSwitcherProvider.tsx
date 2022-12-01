import React, { createContext, useContext } from 'react'
import { SharedValue, useSharedValue } from 'react-native-reanimated'

type AppSwitcherContextValues = {
  isBottomTabBarVisible: SharedValue<number>
}

const AppSwitcherContext = createContext<AppSwitcherContextValues | undefined>(
  undefined
)

export const AppSwitcherProvider = ({
  children,
}: {
  children: React.ReactNode
}) => {
  const isBottomTabBarVisible = useSharedValue(1)

  return (
    <AppSwitcherContext.Provider value={{ isBottomTabBarVisible }}>
      {children}
    </AppSwitcherContext.Provider>
  )
}

export const useAppSwitcherContext = () => {
  const context = useContext(AppSwitcherContext)

  if (!context) {
    throw new Error(
      'useAppSwitcherContext must be used within an AppSwitcherProvider'
    )
  }

  return context
}
