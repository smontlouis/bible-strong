import React, { ComponentProps, ComponentType, Ref } from 'react'
import { ImageStyle, TextStyle, View, ViewStyle } from 'react-native'
import { AnimatedStyle } from 'react-native-reanimated'
import { AnimatedBox } from '~common/ui/Box'

interface TabScreenWrapperProps {
  children: React.ReactNode
  style: AnimatedStyle<ViewStyle | ImageStyle | TextStyle>
  ref?: Ref<View>
  accessibilityElementsHidden?: boolean
  importantForAccessibility?: 'auto' | 'yes' | 'no' | 'no-hide-descendants'
}

const RefableAnimatedBox = AnimatedBox as ComponentType<
  ComponentProps<typeof AnimatedBox> & { ref?: Ref<View> }
>

const TabScreenWrapper = ({
  style,
  children,
  ref,
  accessibilityElementsHidden,
  importantForAccessibility,
}: TabScreenWrapperProps) => {
  return (
    <RefableAnimatedBox
      bg="reverse"
      style={style}
      ref={ref}
      accessibilityElementsHidden={accessibilityElementsHidden}
      importantForAccessibility={importantForAccessibility}
    >
      {children}
    </RefableAnimatedBox>
  )
}

export default TabScreenWrapper
