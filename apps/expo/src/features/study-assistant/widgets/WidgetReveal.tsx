import { useState, type ReactNode } from 'react'
import { StyleSheet } from 'react-native'
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated'
import Box from '~common/ui/Box'
import { useTheme } from '~themes/ThemeProvider'
import { widgetRevealMs } from '../answerReveal'

/**
 * A card placed in an answer being written comes in as the text does, from the top down: a
 * cover in the page's colour slides off it, so its rule draws downward and its lines appear
 * one after the other. Cards of an answer already written show at once.
 */
export default function WidgetReveal({
  animate,
  children,
}: {
  animate: boolean
  children: ReactNode
}) {
  const { colors } = useTheme()
  const reducedMotion = useReducedMotion()
  // Decided once: a card keeps its place in the tree whatever happens next.
  const [covered] = useState(animate && !reducedMotion)
  // Shorter once the answer is written fast (`answerPace.widgetRevealMs`).
  const [duration] = useState(widgetRevealMs)
  return (
    <Box>
      {children}
      {covered && (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: colors.reverse,
              transformOrigin: 'bottom',
              animationName: {
                from: { transform: [{ scaleY: 1 }] },
                to: { transform: [{ scaleY: 0 }] },
              },
              animationDuration: duration,
              // Even, like lines being written, rather than a quick ease-out.
              animationTimingFunction: cubicBezier(0.45, 0, 0.55, 1),
              animationFillMode: 'forwards',
            },
          ]}
        />
      )}
    </Box>
  )
}
