import { useAtomValue } from 'jotai/react'
import { useEffect, useEffectEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Platform, useWindowDimensions } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { runOnJS } from 'react-native-worklets'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import Box, { AnimatedBox, TouchableBox } from '~common/ui/Box'
import { floatingShadow, radii } from '~common/ui/surfaces'
import { colorWithOpacity } from '~themes/colorValues'
import { getBiblePart, getBiblePartColors } from '~themes/bibleBookColors'
import { useTheme } from '~themes/ThemeProvider'
import { useResponsiveWorkspace } from '~features/app-switcher/utils/useResponsiveWorkspace'
import { subscribeToHardwareBackPress } from '~helpers/hardwareBackPress'
import { bibleAudioPassageAtom, bibleAudioPlayerOpenAtom } from '../atoms'
import { closeBibleAudioPlayer } from '../bibleAudioPlayer'
import BibleAudioPlayerContent from './BibleAudioPlayerContent'

const OPEN_DURATION = 280
const CLOSE_DISTANCE = 120
const CLOSE_VELOCITY = 800
/** Width of the panel on a wide screen, where it opens over the bottom of the sidebar. */
const PANEL_WIDTH = 400

/**
 * The large player. On a phone, a full screen that rises from the small player and goes back down
 * with the finger; on a wide screen, a panel at the bottom left, where the small player sits.
 */
const BibleAudioPlayerSheet = () => {
  const { t } = useTranslation()
  const theme = useTheme()
  const isOpen = useAtomValue(bibleAudioPlayerOpenAtom)
  const passage = useAtomValue(bibleAudioPassageAtom)
  const isWide = useResponsiveWorkspace()
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()
  const shouldShow = isOpen && !!passage
  const [isMounted, setIsMounted] = useState(false)
  const offset = useSharedValue(windowHeight)

  const unmount = () => setIsMounted(false)

  useEffect(() => {
    if (shouldShow) {
      setIsMounted(true)
      offset.set(withTiming(0, { duration: OPEN_DURATION, easing: Easing.out(Easing.cubic) }))
      return
    }
    offset.set(
      withTiming(
        windowHeight,
        { duration: OPEN_DURATION, easing: Easing.in(Easing.cubic) },
        done => {
          'worklet'
          if (done) runOnJS(unmount)()
        }
      )
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs on open and close only
  }, [shouldShow])

  // The player closes when the passage goes, as after the cross of the small player.
  useEffect(() => {
    if (!passage && isOpen) closeBibleAudioPlayer()
  }, [passage, isOpen])

  const onBack = useEffectEvent(() => {
    if (!shouldShow) return false
    closeBibleAudioPlayer()
    return true
  })

  useEffect(() => subscribeToHardwareBackPress(() => onBack()), [])

  useEffect(() => {
    if (Platform.OS !== 'web' || !shouldShow) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeBibleAudioPlayer()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [shouldShow])

  const drag = Gesture.Pan()
    .enabled(!isWide)
    .activeOffsetY(10)
    .failOffsetX([-20, 20])
    .onUpdate(event => {
      'worklet'
      offset.set(Math.max(0, event.translationY))
    })
    .onEnd(event => {
      'worklet'
      if (event.translationY > CLOSE_DISTANCE || event.velocityY > CLOSE_VELOCITY) {
        runOnJS(closeBibleAudioPlayer)()
        return
      }
      offset.set(withSpring(0))
    })

  const sheetStyle = useAnimatedStyle(() =>
    isWide
      ? {
          opacity: interpolate(offset.get(), [0, 80], [1, 0], Extrapolation.CLAMP),
          transform: [
            { translateY: interpolate(offset.get(), [0, 80], [0, 16], Extrapolation.CLAMP) },
          ],
        }
      : { transform: [{ translateY: offset.get() }] }
  )

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(offset.get(), [0, windowHeight / 2], [1, 0], Extrapolation.CLAMP),
  }))

  if (!isMounted) return null

  return (
    <Box className="absolute inset-0 z-[50]" pointerEvents="box-none">
      <AnimatedBox
        className="absolute inset-0"
        style={[
          { backgroundColor: isWide ? 'transparent' : colorWithOpacity('#000000', 0.3) },
          backdropStyle,
        ]}
      >
        <TouchableBox
          className="flex-[1]"
          activeOpacity={1}
          onPress={closeBibleAudioPlayer}
          accessibilityRole="button"
          accessibilityLabel={t('accessibility.reduceAudioPlayer')}
        />
      </AnimatedBox>
      <GestureDetector gesture={drag}>
        <AnimatedBox
          className="absolute"
          accessibilityViewIsModal
          style={[
            isWide
              ? {
                  left: 16 + insets.left,
                  bottom: 16 + insets.bottom,
                  width: PANEL_WIDTH,
                  borderRadius: radii.sheet,
                  paddingHorizontal: 20,
                  paddingTop: 18,
                  paddingBottom: 12,
                  backgroundColor: theme.colors.surfaceRaised,
                  ...floatingShadow,
                }
              : {
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  borderTopLeftRadius: radii.sheet,
                  borderTopRightRadius: radii.sheet,
                  paddingTop: insets.top,
                  paddingBottom: insets.bottom + 12,
                  paddingHorizontal: 20,
                  overflow: 'hidden',
                  backgroundColor: theme.colors.canvas,
                },
            sheetStyle,
          ]}
        >
          {!isWide && passage && (
            // The top of the screen takes a tint of the book's part, fading into the page.
            <LinearGradient
              pointerEvents="none"
              colors={[
                getBiblePartColors(getBiblePart(passage.book.Numero), theme).glow,
                colorWithOpacity(theme.colors.canvas, 0) ?? 'transparent',
              ]}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: windowHeight * 0.65,
              }}
            />
          )}
          <BibleAudioPlayerContent layout={isWide ? 'panel' : 'screen'} />
        </AnimatedBox>
      </GestureDetector>
    </Box>
  )
}

export default BibleAudioPlayerSheet
