import { useAtomValue } from 'jotai/react'
import React, { forwardRef } from 'react'
import { ImageStyle, TextStyle, View, ViewStyle } from 'react-native'
import { AnimatedStyleProp } from 'react-native-reanimated'
import { AnimatedBox } from '~common/ui/Box'
import { fullscreenAtom } from '../../../state/app'
import { TAB_ICON_SIZE } from '../utils/constants'

interface TabScreenWrapperProps {
  children: React.ReactNode
  style: AnimatedStyleProp<ViewStyle | ImageStyle | TextStyle>
}

const TabScreenWrapper = forwardRef<View, TabScreenWrapperProps>(
  ({ style, children }, ref) => {
    const isFullscreen = useAtomValue(fullscreenAtom)

    return (
      <AnimatedBox
        bg="reverse"
        style={style}
        ref={ref}
        marginBottom={isFullscreen ? 0 : TAB_ICON_SIZE}
      >
        {children}
      </AnimatedBox>
    )
  }
)

export default TabScreenWrapper
