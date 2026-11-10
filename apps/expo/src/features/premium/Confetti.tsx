// surface-allow: confetti pieces are a drawn illustration, not a surface
import { useEffect, useState } from 'react'
import { StyleSheet, useWindowDimensions } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'

import { resolveThemeColor } from '~themes/colorValues'
import { useTheme } from '~themes/ThemeProvider'

const PIECES = 42
const COLORS = ['primary', 'secondary', 'color2', 'color1', 'color3', 'success'] as const

type Piece = {
  x: number
  delay: number
  duration: number
  sway: number
  turns: number
  spin: number
  width: number
  height: number
  color: (typeof COLORS)[number]
}

const randomBetween = (min: number, max: number) => min + Math.random() * (max - min)

const makePieces = (width: number): Piece[] =>
  Array.from({ length: PIECES }, (_, index) => ({
    x: randomBetween(0, width),
    delay: randomBetween(0, 450),
    duration: randomBetween(2200, 3400),
    sway: randomBetween(12, 36),
    turns: randomBetween(1, 2.5),
    spin: randomBetween(-540, 540),
    width: randomBetween(7, 11),
    height: randomBetween(10, 16),
    color: COLORS[index % COLORS.length]!,
  }))

function ConfettiPiece({ piece, height, color }: { piece: Piece; height: number; color: string }) {
  const progress = useSharedValue(0)
  useEffect(() => {
    progress.set(
      withDelay(
        piece.delay,
        withTiming(1, { duration: piece.duration, easing: Easing.in(Easing.quad) })
      )
    )
  }, [piece, progress])
  const style = useAnimatedStyle(() => {
    const p = progress.get()
    return {
      opacity: p > 0.85 ? (1 - p) / 0.15 : 1,
      transform: [
        { translateX: piece.x + Math.sin(p * Math.PI * 2 * piece.turns) * piece.sway },
        { translateY: -40 + p * (height + 80) },
        { rotate: `${p * piece.spin}deg` },
      ],
    }
  })
  return (
    <Animated.View
      style={[
        styles.piece,
        { width: piece.width, height: piece.height, backgroundColor: color },
        style,
      ]}
    />
  )
}

/**
 * A single shower of confetti in the colours of the theme, over the whole screen, for the
 * moment Premium starts. It falls once and never loops; nothing falls when the reader asked
 * the system to reduce motion.
 */
const Confetti = () => {
  const { width, height } = useWindowDimensions()
  const theme = useTheme()
  const reduceMotion = useReducedMotion()
  const [pieces] = useState(() => makePieces(width))
  if (reduceMotion) return null
  return (
    <Animated.View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((piece, index) => (
        <ConfettiPiece
          key={index}
          piece={piece}
          height={height}
          color={resolveThemeColor(theme, piece.color) ?? piece.color}
        />
      ))}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  piece: { position: 'absolute', top: 0, left: 0, borderRadius: 2 },
})

export default Confetti
