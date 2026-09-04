import { forwardRef } from 'react'
import { ScrollView, type ScrollViewProps } from 'react-native'

type WebKeyboardState = {
  height: number
  isVisible: boolean
}

type WebKeyboardAwareScrollViewProps = ScrollViewProps & {
  bottomOffset?: number
  disableScrollOnKeyboardHide?: boolean
}

const KeyboardAwareScrollView = forwardRef<ScrollView, WebKeyboardAwareScrollViewProps>(
  ({ bottomOffset: _bottomOffset, disableScrollOnKeyboardHide: _disable, ...props }, ref) => (
    <ScrollView ref={ref} {...props} />
  )
)

const webKeyboardState: WebKeyboardState = {
  height: 0,
  isVisible: false,
}

const useKeyboardState = <T,>(selector: (state: WebKeyboardState) => T): T =>
  selector(webKeyboardState)

export { KeyboardAwareScrollView, useKeyboardState }
