import { MaterialCommunityIcons } from '@expo/vector-icons'
import { Pressable, View } from 'react-native'
import Animated, { css } from 'react-native-reanimated'
import Metal, { METAL_COLORS } from './metal'

/** The medallion's size, in points. */
const SIZE = 112

/** It breathes, slowly: a little larger, then back. Declared once, so it never restarts. */
const BREATH = css.keyframes({
  '0%': { transform: [{ scale: 1 }] },
  '50%': { transform: [{ scale: 1.035 }] },
  '100%': { transform: [{ scale: 1 }] },
})

/**
 * The door to the prayer of the day (2026-11-26): joined hands in a ring of gold whose
 * reflections turn slowly, and that breathes. A press opens the prayer. A reader who asked for
 * less motion sees it still.
 */
const PrayerMedallion = ({
  label,
  still,
  onPress,
}: {
  label: string
  still: boolean
  onPress: () => void
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
    hitSlop={12}
    style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.96 : 1 }] })}
  >
    <Animated.View
      style={
        still
          ? undefined
          : {
              animationName: BREATH,
              animationDuration: 4500,
              animationIterationCount: 'infinite',
              animationTimingFunction: 'ease-in-out',
            }
      }
    >
      <Metal
        colors={METAL_COLORS.gold}
        borderWidth={3}
        bevel={0.8}
        glow={0.6}
        sheen={0.55}
        speed={0.35}
        bands={2}
        sharpness={1.6}
        paused={still}
      >
        <View
          style={{
            width: SIZE,
            height: SIZE,
            borderRadius: SIZE / 2,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255,255,255,0.08)',
          }}
        >
          <MaterialCommunityIcons name="hands-pray" size={46} color="#fff7e6" />
        </View>
      </Metal>
    </Animated.View>
  </Pressable>
)

export default PrayerMedallion
