import React, { createContext, memo, useContext, useMemo } from 'react'
import { ScrollView, View } from 'react-native'
import {
  SharedValue,
  useAnimatedRef,
  useSharedValue,
} from 'react-native-reanimated'
import { useOnceAtoms } from './utils/useOnceAtoms'
import useTabConstants from './utils/useTabConstants'

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
    opacity: SharedValue<number>
    atomId: SharedValue<string | null>
  }
  scrollView: {
    ref: React.RefObject<ScrollView>
    y: SharedValue<number>
    padding: SharedValue<number>
  }
  tabPreviews: {
    refs: React.RefObject<View>[]
  }
  tabPreviewCarousel: {
    translateY: SharedValue<number>
    opacity: SharedValue<number>
  }
}

const AppSwitcherContext = createContext<AppSwitcherContextValues | undefined>(
  undefined
)

interface AppSwitcherProviderProps {
  children: React.ReactNode
}

export const AppSwitcherProvider = memo(
  ({ children }: AppSwitcherProviderProps) => {
    const scrollViewRef = useAnimatedRef<ScrollView>()
    const { initialAtomId, initialTabIndex } = useOnceAtoms()
    const memoizedChildren = useMemo(() => children, [])
    const { HEIGHT } = useTabConstants()

    const tabPreviewRefs = useMemo(() => new Array(100), [])

    const isBottomTabBarVisible = useSharedValue(1)

    const scrollView = {
      ref: scrollViewRef,
      y: useSharedValue(0),
      padding: useSharedValue(0),
    }

    const tabPreviews = {
      refs: tabPreviewRefs,
    }

    const activeTabPreview = {
      index: useSharedValue(initialTabIndex === -1 ? 0 : initialTabIndex),
      top: useSharedValue(0),
      left: useSharedValue(0),
      opacity: useSharedValue(0),
      animationProgress: useSharedValue(initialTabIndex === -1 ? 0 : 1),
      zIndex: useSharedValue(2),
    }

    const activeTabScreen = {
      opacity: useSharedValue(1),
      atomId: useSharedValue(initialAtomId),
    }

    const tabPreviewCarousel = {
      // No need to mount/unmount the carousel, just visually hide it
      translateY: useSharedValue(HEIGHT),
      opacity: useSharedValue(0),
    }

    const contextValue: AppSwitcherContextValues = React.useMemo(
      () => ({
        isBottomTabBarVisible,
        activeTabPreview,
        activeTabScreen,
        scrollView,
        tabPreviews,
        tabPreviewCarousel,
      }),
      []
    )

    return (
      <AppSwitcherContext.Provider value={contextValue}>
        {memoizedChildren}
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
