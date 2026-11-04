import { TextInput, type StyleProp, type TextStyle } from 'react-native'
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated'

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput)

/**
 * A year written by the UI thread as the stage moves, without a render: a text field nobody can
 * edit is the one native text whose content can be set from there. It keeps the size of its
 * style, since nothing measures it again when the year changes.
 */
const TimelineStageYearText = ({
  year,
  format,
  initial,
  style,
}: {
  year: SharedValue<number>
  /** A worklet that writes a year. */
  format: (year: number) => string
  /** What it shows before the stage first moves. */
  initial: string
  style: StyleProp<TextStyle>
}) => {
  const animatedProps = useAnimatedProps(() => {
    const text = format(year.get())
    return { text, defaultValue: text } as Partial<{ text: string; defaultValue: string }>
  })
  return (
    <AnimatedTextInput
      editable={false}
      pointerEvents="none"
      caretHidden
      contextMenuHidden
      underlineColorAndroid="transparent"
      importantForAccessibility="no"
      accessibilityElementsHidden
      defaultValue={initial}
      animatedProps={animatedProps}
      style={[{ padding: 0, margin: 0 }, style]}
    />
  )
}

export default TimelineStageYearText
