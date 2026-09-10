import { Text as NativeText, type TextProps as NativeTextProps } from 'react-native'
import Animated from 'react-native-reanimated'
import { twMerge } from './classNames'

export type TextProps = NativeTextProps & {
  className?: string
  ref?: React.Ref<NativeText>
}

/** App typography defaults; all caller styling uses className or native style. */
const Text = ({ className, style, ...props }: TextProps) => {
  return (
    <NativeText
      {...props}
      className={twMerge(
        'text-default text-[16px] shrink-0 basis-auto content-start flex-nowrap flex-col',
        className
      )}
      style={style}
    />
  )
}

export const AnimatedText = Animated.createAnimatedComponent(Text)
export default Text
