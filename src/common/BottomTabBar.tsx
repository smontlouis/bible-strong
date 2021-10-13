import React from 'react'
import styled from '@emotion/native'
import { getBottomSpace } from 'react-native-iphone-x-helper'
import * as Animatable from 'react-native-animatable'
import { useGlobalContext } from '~helpers/globalContext'
import { usePrevious } from '~helpers/usePrevious'

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
  overflow: 'visible',
  paddingBottom: getBottomSpace(),
  backgroundColor: theme.colors.reverse,
  paddingHorizontal: 20,
  alignItems: 'flex-end',
  justifyContent: 'space-around',

  // ...(orientation.landscape && {
  //   overflow: 'hidden',
  //   flexDirection: 'column',
  //   paddingHorizontal: 10
  // })
}))

const AnimatableContainer = Animatable.createAnimatableComponent(Container)

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
  const {
    fullscreen: [isFullscreen, setFullScreen],
  } = useGlobalContext()

  // React.useEffect(() => {
  //   if (activeRouteIndex === 2 && prevIndex !== activeRouteIndex) {
  //      setFullScreen(true)
  //   }
  //   if (prevIndex === 2 && prevIndex !== activeRouteIndex) {
  //     setFullScreen(false)
  //   }
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [prevIndex, activeRouteIndex])

  return (
    <AnimatableContainer
      orientation={orientation}
      transition="height"
      easing="ease-in-out"
      duration={400}
      style={{
        overflow: isFullscreen ? 'hidden' : 'visible',
        paddingTop: activeRouteIndex === 2 ? (isFullscreen ? 0 : 15) : 0,
        height:
          activeRouteIndex === 2
            ? isFullscreen
              ? 0
              : 60 + getBottomSpace()
            : 40 + getBottomSpace(),
      }}
    >
      {routes.map((route, routeIndex) => {
        const isRouteActive = routeIndex === activeRouteIndex
        const tintColor = isRouteActive ? activeTintColor : inactiveTintColor

        return (
          <TouchableTab
            key={routeIndex}
            // orientation={orientation}
            onPress={() => {
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
