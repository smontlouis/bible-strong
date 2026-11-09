import { createContext, use } from 'react'
import { Text as NativeText, type TextProps as NativeTextProps } from 'react-native'
import Animated from 'react-native-reanimated'
import { useTheme } from '~themes/ThemeProvider'
import { resolveTextTypography } from './textTypography'
import { twMerge } from './classNames'

export type TextProps = NativeTextProps & {
  className?: string
  ref?: React.Ref<NativeText>
}

/** Whether a text sits inside another, whose face it then inherits. */
const InsideTextContext = createContext(false)

/** App typography defaults; all caller styling uses className or native style. */
const Text = ({ className, style, ...props }: TextProps) => {
  const theme = useTheme()
  const insideText = use(InsideTextContext)
  return (
    <InsideTextContext value>
      <NativeText
        {...props}
        className={twMerge(
          'text-default text-[16px] shrink-0 basis-auto content-start flex-nowrap flex-col',
          className
        )}
        style={resolveTextTypography(insideText ? undefined : theme.fontFamily.text, style)}
      />
    </InsideTextContext>
  )
}

export const AnimatedText = Animated.createAnimatedComponent(Text)
export default Text
