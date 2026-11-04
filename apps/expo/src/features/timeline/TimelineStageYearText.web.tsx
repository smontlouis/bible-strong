import { useState } from 'react'
import { Text, type StyleProp, type TextStyle } from 'react-native'
import { useAnimatedReaction, type SharedValue } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

/**
 * A year that follows the stage. On the Web a text field cannot be written by an animation, so
 * this small text renders on its own when the year changes, and nothing around it does.
 */
const TimelineStageYearText = ({
  year,
  format,
  initial,
  style,
}: {
  year: SharedValue<number>
  format: (year: number) => string
  initial: string
  style: StyleProp<TextStyle>
}) => {
  const [text, setText] = useState(initial)
  useAnimatedReaction(
    () => format(year.get()),
    (current, previous) => {
      if (current !== previous) scheduleOnRN(setText, current)
    }
  )
  return (
    <Text numberOfLines={1} style={style}>
      {text}
    </Text>
  )
}

export default TimelineStageYearText
