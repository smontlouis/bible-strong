import { useAtomValue } from 'jotai'
import React, { createContext, memo, useContext, useMemo } from 'react'
import { ScrollView, View } from 'react-native'
import { TapGestureHandler } from 'react-native-gesture-handler'
import {
  SharedValue,
  useAnimatedRef,
  useSharedValue,
} from 'react-native-reanimated'
import { activeTabIndexAtom, tabsAtomsAtom } from '../../state/tabs'

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
    ref: React.RefObject<View>
    opacity: SharedValue<number>
  }
  scrollView: {
    ref: React.RefObject<ScrollView>
    y: SharedValue<number>
  }
  tabPreviews: {
    gestureRefs: React.RefObject<TapGestureHandler>[]
    refs: React.RefObject<View>[]
  }
}

const AppSwitcherContext = createContext<AppSwitcherContextValues | undefined>(
  undefined
)

export const AppSwitcherProvider = memo(
  ({ children }: { children: React.ReactNode }) => {
    const scrollViewRef = useAnimatedRef<ScrollView>()
    const tabScreenRef = React.useRef<View>(null)
    const tabsAtoms = useAtomValue(tabsAtomsAtom)
    const activeTabIndex = useAtomValue(activeTabIndexAtom)

    const tabPreviewGestureRefs = useMemo(
      () => tabsAtoms.map(() => React.createRef<TapGestureHandler>()),
      [tabsAtoms]
    )

    const tabPreviewRefs = useMemo(() => new Array(tabsAtoms.length), [
      tabsAtoms,
    ])

    const isBottomTabBarVisible = useSharedValue(1)

    const scrollView = {
      ref: scrollViewRef,
      y: useSharedValue(0),
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
      ref: tabScreenRef,
      opacity: useSharedValue(1),
    }

    const contextValue: AppSwitcherContextValues = React.useMemo(
      () => ({
        isBottomTabBarVisible,
        activeTabPreview,
        activeTabScreen,
        scrollView,
        tabPreviews,
      }),
      [tabsAtoms]
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
