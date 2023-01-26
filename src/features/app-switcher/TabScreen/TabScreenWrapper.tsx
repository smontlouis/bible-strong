import { useAtomValue } from 'jotai/react'
import React, { forwardRef } from 'react'
import { ImageStyle, TextStyle, View, ViewStyle } from 'react-native'
import { getBottomSpace } from 'react-native-iphone-x-helper'
import { AnimatedStyleProp } from 'react-native-reanimated'
import { AnimatedBox } from '~common/ui/Box'
import { fullscreenAtom } from '../../../state/app'

interface TabScreenWrapperProps {
  children: React.ReactNode
  style: AnimatedStyleProp<ViewStyle | ImageStyle | TextStyle>
}

const TabScreenWrapper = forwardRef<View, TabScreenWrapperProps>(
  ({ style, children }, ref) => {
    const isFullscreen = useAtomValue(fullscreenAtom)
    return (
      <AnimatedBox
        style={style}
        bg="reverse"
        {...(isFullscreen
          ? { paddingBottom: getBottomSpace() }
          : { bottomTabBarPadding: true })}
        ref={ref}
      >
        {children}
      </AnimatedBox>
    )
  }
)

export default TabScreenWrapper
