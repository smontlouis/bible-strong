import { useEffect, type ComponentProps, type ReactNode } from 'react'
import { Pressable } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import { AnimatedBox } from '~common/ui/Box'
import { twMerge } from '~common/ui/classNames'
import { useTheme } from '~themes/ThemeProvider'
import { colorWithOpacity, resolveThemeColor } from '~themes/colorValues'

/**
 * Every demo is drawn on one stage, in points: narrow enough for the smallest phone's sheet once
 * its margins are taken, so that nothing is measured.
 */
export const STAGE_WIDTH = 280
export const STAGE_HEIGHT = 150

/** How many times a demo plays when its step shows: a few, then it rests on what it shows. */
const PLAYS = 3
const FIRST_DELAY_MS = 350
const REST_MS = 1100

/**
 * The time of a demo, from 0 to 1, played a few times and left at 1: the demo's last frame shows
 * what the gesture gives. With reduced motion, the demo shows that frame alone. Touching the stage
 * plays it again.
 */
export function useDemoProgress(cycleMs: number) {
  const reduceMotion = useReducedMotion()
  const progress = useSharedValue(reduceMotion ? 1 : 0)

  const play = () => {
    if (reduceMotion) {
      progress.set(1)
      return
    }
    cancelAnimation(progress)
    progress.set(0)
    const cycle = () => withTiming(1, { duration: cycleMs, easing: Easing.linear })
    const again = () => withSequence(withDelay(REST_MS, withTiming(0, { duration: 0 })), cycle())
    const plays = [cycle(), ...Array.from({ length: PLAYS - 1 }, again)]
    progress.set(withDelay(FIRST_DELAY_MS, withSequence(...plays)))
  }

  useEffect(() => {
    play()
    return () => cancelAnimation(progress)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { progress, replay: play }
}

/** A value of the demo's time, between key moments, held before the first and after the last. */
export const at = (progress: number, times: number[], values: number[]) => {
  'worklet'
  return interpolate(progress, times, values, Extrapolation.CLAMP)
}

/** The stage of a demo: a fixed drawing, centered, that replays when touched. */
export function DemoStage({
  onReplay,
  label,
  children,
}: {
  onReplay: () => void
  label: string
  children: ReactNode
}) {
  return (
    <Pressable
      onPress={onReplay}
      accessibilityRole="image"
      accessibilityLabel={label}
      className="items-center justify-center py-[12px]"
    >
      <Animated.View style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT, overflow: 'hidden' }}>
        {children}
      </Animated.View>
    </Pressable>
  )
}

/** A style of a shape, animated or not. */
type ShapeStyle = ComponentProps<typeof AnimatedBox>['style']

/** A shape of the drawing, set at a place of the stage. */
export function Shape({
  x,
  y,
  width,
  height,
  className,
  style,
  children,
}: {
  x: number
  y: number
  width: number
  height: number
  className?: string
  style?: ShapeStyle
  children?: ReactNode
}) {
  return (
    <AnimatedBox
      className={twMerge('absolute overflow-hidden', className)}
      style={[{ left: x, top: y, width, height }, style]}
    >
      {children}
    </AnimatedBox>
  )
}

/** A line of text, drawn as a bar. */
export function Bone({
  x,
  y,
  width,
  height = 6,
  className,
}: {
  x: number
  y: number
  width: number
  height?: number
  className?: string
}) {
  return (
    <Shape
      x={x}
      y={y}
      width={width}
      height={height}
      className={twMerge('rounded-full bg-border', className)}
    />
  )
}

/** A screen of the app in miniature: the surface of a card, at a card's radius. */
export function MiniSurface({
  x,
  y,
  width,
  height,
  children,
  style,
}: {
  x: number
  y: number
  width: number
  height: number
  children?: ReactNode
  style?: ShapeStyle
}) {
  return (
    <Shape
      x={x}
      y={y}
      width={width}
      height={height}
      className="rounded-[16px] bg-reverse border-continuous"
      style={style}
    >
      {children}
    </Shape>
  )
}

export type FingerKeys = {
  /** Key moments of the demo's time, from 0 to 1. */
  times: number[]
  /** The centre of the touch at each moment. */
  x: number[]
  y: number[]
  /** 1 while the finger presses, 0 while it hovers. */
  down: number[]
  /** 1 while the touch shows. */
  shown: number[]
  /** For a long press: from 0 to 1 while the press is held. */
  hold?: number[]
}

const FINGER_SIZE = 30

/** The touch of a finger: where it lands, when it presses, how long it holds. */
export function Finger({ progress, keys }: { progress: SharedValue<number>; keys: FingerKeys }) {
  const theme = useTheme()
  const ink = resolveThemeColor(theme, 'default') ?? '#101b35'

  const touchStyle = useAnimatedStyle(() => {
    const p = progress.get()
    const down = at(p, keys.times, keys.down)
    return {
      opacity: at(p, keys.times, keys.shown) * (0.6 + 0.4 * down),
      transform: [
        { translateX: at(p, keys.times, keys.x) - FINGER_SIZE / 2 },
        { translateY: at(p, keys.times, keys.y) - FINGER_SIZE / 2 },
        { scale: 1 - 0.2 * down },
      ],
    }
  })

  const holdStyle = useAnimatedStyle(() => {
    const p = progress.get()
    const hold = keys.hold ? at(p, keys.times, keys.hold) : 0
    return {
      opacity: hold > 0 && hold < 1 ? 0.5 * (1 - hold) : 0,
      transform: [{ scale: 1 + hold * 0.9 }],
    }
  })

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', left: 0, top: 0, width: FINGER_SIZE, height: FINGER_SIZE },
        touchStyle,
      ]}
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            inset: 0,
            borderRadius: FINGER_SIZE / 2,
            borderWidth: 2,
            borderColor: ink,
          },
          holdStyle,
        ]}
      />
      <Animated.View
        style={{
          flex: 1,
          borderRadius: FINGER_SIZE / 2,
          backgroundColor: colorWithOpacity(ink, 0.22),
          borderWidth: 1.5,
          borderColor: colorWithOpacity(ink, 0.45),
        }}
      />
    </Animated.View>
  )
}
