import React from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

interface AccordionItemProps {
  isExpanded: SharedValue<boolean>
  children: React.ReactNode
  viewKey: string
  style?: StyleProp<ViewStyle>
  duration?: number
  /** Mounts already open at this height, without animating. */
  initialHeight?: number
}

function AccordionItem({
  isExpanded,
  children,
  viewKey,
  style,
  duration = 300,
  initialHeight = 0,
}: AccordionItemProps) {
  const height = useSharedValue(initialHeight)
  const animatedHeight = useSharedValue(initialHeight)

  // Starting at `initialHeight`, an item that mounts open has nothing to animate
  useAnimatedReaction(
    () => height.get() * Number(isExpanded.get()),
    target => {
      animatedHeight.set(withTiming(target, { duration }))
    }
  )
  const bodyStyle = useAnimatedStyle(() => ({
    height: animatedHeight.get(),
  }))

  return (
    <Animated.View key={`accordionItem_${viewKey}`} style={[styles.animatedView, bodyStyle, style]}>
      <View
        onLayout={e => {
          height.set(e.nativeEvent.layout.height)
        }}
        style={styles.wrapper}
      >
        {children}
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  animatedView: {
    overflow: 'hidden',
  },
  wrapper: {
    position: 'absolute',
    width: '100%',
  },
})

export default AccordionItem
