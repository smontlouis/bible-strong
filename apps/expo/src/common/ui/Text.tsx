import { Text as NativeText, type TextProps as NativeTextProps } from 'react-native'
import Animated from 'react-native-reanimated'
import { useResolveClassNames } from 'uniwind'
import { useTheme } from '~themes/ThemeProvider'

export type TextProps = NativeTextProps & {
  className?: string
  ref?: React.Ref<NativeText>
}

/** App typography defaults; all caller styling uses className or native style. */
const Text = ({ className, style, ...props }: TextProps) => {
  const theme = useTheme()
  const classStyles = useResolveClassNames(className ?? '')
  return (
    <NativeText
      {...props}
      style={[
        {
          color: theme.colors.default,
          fontSize: 16,
          flexShrink: 0,
          flexBasis: 'auto',
          alignContent: 'flex-start',
          flexWrap: 'nowrap',
          flexDirection: 'column',
        },
        className ? classStyles : undefined,
        style,
      ]}
    />
  )
}

export const AnimatedText = Animated.createAnimatedComponent(Text)
export default Text
