import React from 'react'
import { ViewStyle, ImageStyle, TextStyle } from 'react-native'
import { AnimatedStyleProp } from 'react-native-reanimated'
import { AnimatedBox } from './TabPreview'

interface TabScreenWrapperProps {
  children: React.ReactNode
  style: AnimatedStyleProp<ViewStyle | ImageStyle | TextStyle>
}

const TabScreenWrapper = ({ style, children }: TabScreenWrapperProps) => {
  return (
    <AnimatedBox style={style} bg="reverse" bottomTabBarPadding>
      {children}
    </AnimatedBox>
  )
}

export default TabScreenWrapper
