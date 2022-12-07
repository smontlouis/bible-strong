import { unstable_createStore } from 'jotai'
import React, { createContext, memo, useContext, useMemo } from 'react'
import { ScrollView, View } from 'react-native'
import { TapGestureHandler } from 'react-native-gesture-handler'
import {
  SharedValue,
  useAnimatedRef,
  useSharedValue,
} from 'react-native-reanimated'
import { activeTabIndexAtom, tabsAtomsAtom } from '../../state/tabs'
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
    gestureRefs: React.RefObject<TapGestureHandler>[]
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

const store = unstable_createStore()

export const AppSwitcherProvider = memo(
  ({ children }: { children: React.ReactNode }) => {
    const scrollViewRef = useAnimatedRef<ScrollView>()
    const tabsAtoms = store.get(tabsAtomsAtom)!
    const activeTabIndex = store.get(activeTabIndexAtom)!
    const { HEIGHT } = useTabConstants()

    const tabPreviewGestureRefs = useMemo(
      () => new Array(100).fill(React.createRef<TapGestureHandler>()),
      []
    )

    const tabPreviewRefs = useMemo(() => new Array(100), [])

    const isBottomTabBarVisible = useSharedValue(1)

    const scrollView = {
      ref: scrollViewRef,
      y: useSharedValue(0),
      padding: useSharedValue(0),
    }

    const tabPreviews = {
      gestureRefs: tabPreviewGestureRefs,
      refs: tabPreviewRefs,
    }

    const activeTabPreview = {
      index: useSharedValue(activeTabIndex || 0),
      top: useSharedValue(0),
      left: useSharedValue(0),
      opacity: useSharedValue(0),
      animationProgress: useSharedValue(1),
      zIndex: useSharedValue(2),
    }

    const activeTabScreen = {
      opacity: useSharedValue(1),
      atomId: useSharedValue(tabsAtoms[activeTabIndex || 0].toString()),
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
