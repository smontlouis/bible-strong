import type { StyleProp, ViewStyle } from 'react-native'

import Box from '~common/ui/Box'

type NotificationDotProps = {
  size?: number
  style?: StyleProp<ViewStyle>
}

/** Small green dot signalling something new; outlined so it stays legible over an icon. */
const NotificationDot = ({ size = 10, style }: NotificationDotProps) => (
  <Box
    className="bg-success border-reverse"
    pointerEvents="none"
    accessible={false}
    style={[{ width: size, height: size, borderRadius: size / 2, borderWidth: 1.5 }, style]}
  />
)

export default NotificationDot
