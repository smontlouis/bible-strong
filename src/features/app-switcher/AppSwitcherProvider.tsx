import React, { createContext, memo, useContext } from 'react'
import { SharedValue, useSharedValue } from 'react-native-reanimated'

type AppSwitcherContextValues = {
  isBottomTabBarVisible: SharedValue<number>
  activeTabPreview: {
    index: SharedValue<number>
    top: SharedValue<number>
    left: SharedValue<number>
    opacity: SharedValue<number>
    animationProgress: SharedValue<number>
    zIndex: SharedValue<number>
  }
  activeTabScreen: {
    animationProgress: SharedValue<number>
    opacity: SharedValue<number>
  }
}

const AppSwitcherContext = createContext<AppSwitcherContextValues | undefined>(
  undefined
)

export const AppSwitcherProvider = memo(
  ({ children }: { children: React.ReactNode }) => {
    const isBottomTabBarVisible = useSharedValue(1)

    const activeTabPreview = {
      index: useSharedValue(0),
      top: useSharedValue(0),
      left: useSharedValue(0),
      opacity: useSharedValue(0),
      animationProgress: useSharedValue(0),
      zIndex: useSharedValue(2),
    }

    const activeTabScreen = {
      animationProgress: useSharedValue(0),
      opacity: useSharedValue(1),
    }

    const contextValue = React.useMemo(
      () => ({
        isBottomTabBarVisible,
        activeTabPreview,
        activeTabScreen,
      }),
      []
    )

    return (
      <AppSwitcherContext.Provider value={contextValue}>
        {children}
      </AppSwitcherContext.Provider>
    )
  }
)

export const useAppSwitcherContext = () => {
  const context = useContext(AppSwitcherContext)

  if (!context) {
    throw new Error(
      'useAppSwitcherContext must be used within an AppSwitcherProvider'
    )
  }

  return context
}
