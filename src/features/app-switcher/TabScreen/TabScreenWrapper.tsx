import React, { Ref } from 'react'
import { ImageStyle, TextStyle, View, ViewStyle } from 'react-native'
import { AnimatedStyle } from 'react-native-reanimated'
import { AnimatedBox } from '~common/ui/Box'

interface TabScreenWrapperProps {
  children: React.ReactNode
  style: AnimatedStyle<ViewStyle | ImageStyle | TextStyle>
  ref?: Ref<View>
}

const TabScreenWrapper = ({ style, children, ref }: TabScreenWrapperProps) => {
  return (
    // @ts-ignore
    <AnimatedBox bg="reverse" style={style} ref={ref}>
      {children}
    </AnimatedBox>
  )
}

export default TabScreenWrapper
