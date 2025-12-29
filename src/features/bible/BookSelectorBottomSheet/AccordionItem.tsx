import React from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

interface AccordionItemProps {
  isExpanded: SharedValue<boolean>
  children: React.ReactNode
  viewKey: string
  style?: any
  duration?: number
}

function AccordionItem({
  isExpanded,
  children,
  viewKey,
  style,
  duration = 300,
}: AccordionItemProps) {
  const height = useSharedValue(0)

  const derivedHeight = useDerivedValue(() =>
    withTiming(height.get() * Number(isExpanded.get()), {
      duration,
    })
  )
  const bodyStyle = useAnimatedStyle(() => ({
    height: derivedHeight.get(),
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
