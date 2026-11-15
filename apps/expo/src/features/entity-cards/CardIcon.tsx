// surface-allow: a collectible card is a drawn object with its own edge, radius and shadow (ADR-0090)
import { useEffect, useRef } from 'react'
import { View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

import { backgroundImage } from '~common/ui/backgroundImage'
import { useTheme } from '~themes/ThemeProvider'

export const CARD_ICON_WIDTH = 22
export const CARD_ICON_HEIGHT = 30

/**
 * A character's card in its header (ADR-0090): a small card, grey and empty until the reader
 * collects it, then gold like the dot that announced it. The moment it turns gold, it jumps and a
 * gold ring spreads from it: the card has landed in the collection.
 */
export const CardIcon = ({ collected }: { collected: boolean }) => {
  const theme = useTheme()
  const reduceMotion = useReducedMotion()
  const ink = collected ? '#b9851c' : theme.colors.grey

  const scale = useSharedValue(1)
  const ring = useSharedValue(0)
  const wasCollected = useRef(collected)
  useEffect(() => {
    const turnedGold = collected && !wasCollected.current
    wasCollected.current = collected
    if (!turnedGold || reduceMotion) return
    scale.set(
      withSequence(
        withTiming(1.4, { duration: 140, easing: Easing.out(Easing.quad) }),
        withSpring(1, { damping: 7, stiffness: 260, mass: 0.6 })
      )
    )
    ring.set(withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: 650 })))
  }, [collected, reduceMotion, scale, ring])

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }, { rotate: '-8deg' }],
  }))
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ring.get() > 0 && ring.get() < 1 ? 0.9 * (1 - ring.get()) : 0,
    transform: [{ scale: 1 + ring.get() * 1.3 }, { rotate: '-8deg' }],
  }))

  return (
    <View style={{ width: CARD_ICON_WIDTH, height: CARD_ICON_HEIGHT }}>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            inset: 0,
            borderRadius: 5,
            borderCurve: 'continuous',
            borderWidth: 2,
            borderColor: '#f2c14e',
          },
          ringStyle,
        ]}
      />
      <Animated.View
        style={[
          {
            width: CARD_ICON_WIDTH,
            height: CARD_ICON_HEIGHT,
            borderRadius: 4,
            borderCurve: 'continuous',
            borderWidth: 1.5,
            borderColor: ink,
            padding: 2.5,
            opacity: collected ? 1 : 0.45,
            // The gold under the gradient, while it is drawn.
            backgroundColor: collected ? '#f2c14e' : undefined,
            ...backgroundImage(
              collected
                ? 'linear-gradient(135deg, #fff1b8 0%, #f2c14e 45%, #d39a1f 100%)'
                : undefined
            ),
            boxShadow: collected ? '0 1px 4px rgba(185, 133, 28, 0.45)' : undefined,
          },
          cardStyle,
        ]}
      >
        <View
          style={{
            flex: 1,
            borderRadius: 2,
            borderColor: collected ? 'rgba(255, 255, 255, 0.75)' : ink,
            borderWidth: 1,
          }}
        />
      </Animated.View>
    </View>
  )
}
