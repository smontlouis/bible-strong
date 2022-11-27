import styled from '@emotion/native'
import { useAtom } from 'jotai'
import React from 'react'
import * as Animatable from 'react-native-animatable'
import { getBottomSpace } from 'react-native-iphone-x-helper'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated'
import { tabTimingConfig } from '~features/app-switcher/TabScreen'
import { fullscreenAtom } from '../state/app'
import {
  activeTabIndexAtom,
  activeTabPropertiesAtom,
  tabActiveTabSnapshotAtom,
} from '../state/tabs'

const TouchableTab = styled.TouchableOpacity(({ orientation }) => ({
  position: 'relative',
  justifyContent: 'flex-start',
  alignItems: 'center',
  width: 70,
  height: 40,
  overflow: 'visible',

  // ...(orientation.landscape && {
  //   width: 50,
  //   height: 50,
  //   justifyContent: 'center'
  // })
}))

const Circle = styled.View(({ theme, orientation }) => ({
  position: 'absolute',

  width: 6,
  height: 6,
  borderRadius: 3,
  backgroundColor: theme.colors.primary,
  left: 35 - 3,
}))

const AnimatableCircle = Animatable.createAnimatableComponent(Circle)

const Container = styled.View(({ theme, orientation }) => ({
  flexDirection: 'row',
  paddingBottom: getBottomSpace(),
  paddingTop: 15,
  backgroundColor: theme.colors.reverse,
  paddingHorizontal: 20,
  alignItems: 'flex-end',
  justifyContent: 'space-around',
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,

  borderTopLeftRadius: 10,
  borderTopRightRadius: 10,

  shadowColor: theme.colors.default,
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.2,
  shadowRadius: 7,

  // ...(orientation.landscape && {
  //   overflow: 'hidden',
  //   flexDirection: 'column',
  //   paddingHorizontal: 10
  // })
}))

const AnimatableContainer = Animated.createAnimatedComponent(Container)

const TabBar = props => {
  const {
    renderIcon,
    getLabelText,
    activeTintColor,
    inactiveTintColor,
    onTabPress,
    getAccessibilityLabel,
    navigation,
    orientation,
  } = props

  const { routes, index: activeRouteIndex } = navigation.state
  // const prevIndex = usePrevious(activeRouteIndex)
  const [isFullscreen] = useAtom(fullscreenAtom)
  const [activeTabIndex, setActiveTabIndex] = useAtom(activeTabIndexAtom)
  const [, tabActiveTabSnapshot] = useAtom(tabActiveTabSnapshotAtom)

  const [activeTabProperties, setActiveTabProperties] = useAtom(
    activeTabPropertiesAtom
  )
  const { animationProgress } = activeTabProperties || {}

  const onClose = () => {
    setActiveTabIndex(undefined)
    setActiveTabProperties(undefined)
  }

  const isHidden =
    isFullscreen || (activeRouteIndex === 2 && activeTabIndex === undefined)

  const height = (() => {
    if (isHidden) {
      return 60 + getBottomSpace()
    }
    return 0
  })()

  const style = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: withTiming(height),
        },
      ],
    }
  })
  return (
    <AnimatableContainer orientation={orientation} style={style}>
      {routes.map((route, routeIndex) => {
        const isRouteActive = routeIndex === activeRouteIndex
        const tintColor = isRouteActive ? activeTintColor : inactiveTintColor

        return (
          <TouchableTab
            key={routeIndex}
            // orientation={orientation}
            onPress={async () => {
              if (
                route.routeName === 'AppSwitcher' &&
                isRouteActive &&
                animationProgress?.value
              ) {
                await tabActiveTabSnapshot(activeTabIndex)
                animationProgress.value = withTiming(0, tabTimingConfig, () => {
                  runOnJS(onClose)()
                })

                return
              }
              onTabPress({ route })
            }}
            accessibilityLabel={getAccessibilityLabel({ route })}
          >
            {renderIcon({ route, focused: isRouteActive, tintColor })}
            <AnimatableCircle
              orientation={orientation}
              transition="bottom"
              style={{ bottom: isRouteActive ? 8 : -100 }}
            />
          </TouchableTab>
        )
      })}
    </AnimatableContainer>
  )
}

export default TabBar
