// surface-allow: a collectible card is a drawn object with its own edge, radius and shadow (ADR-0090)
import * as Haptics from 'expo-haptics'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { FullWindowOverlay } from 'react-native-screens'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { scheduleOnRN } from 'react-native-worklets'

import { backgroundImage } from '~common/ui/backgroundImage'
import ChromaRing from '~common/ui/effects/ChromaRing'
import { FeatherIcon } from '~common/ui/Icon'

import type { EntityCardView } from './cardCatalog'
import { prefetchCards } from './cardPrefetch'
import { EntityCardCanvas, getEntityCardCanvasSize } from './EntityCardCanvas'

export type WindowRect = { x: number; y: number; width: number; height: number }

/**
 * Above everything, the open sheet included. On iOS a form sheet is a UIKit presentation laid over
 * the React Native root: only a layer of the window stands in front of it, and its gestures need
 * their own root. Elsewhere a transparent modal covers the screen.
 */
const AboveEverything = ({ children, onClose }: { children: ReactNode; onClose: () => void }) =>
  Platform.OS === 'ios' ? (
    <FullWindowOverlay>
      <GestureHandlerRootView style={StyleSheet.absoluteFill}>{children}</GestureHandlerRootView>
    </FullWindowOverlay>
  ) : (
    <Modal
      transparent
      visible
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={StyleSheet.absoluteFill}>{children}</GestureHandlerRootView>
    </Modal>
  )

type CardSpotlightProps = {
  card: EntityCardView
  /** `reveal`: a new card, collected with « Récupérer »; `view`: a collected card, opened large. */
  mode: 'reveal' | 'view'
  /** Where the card lands once collected, in the window's coordinates. */
  getLandingRect?: () => Promise<WindowRect | undefined>
  onCollect?: () => void
  /** The collected card reaches the header: the place there takes its turn to show it. */
  onLanded?: () => void
  /** The card's character, from the album: the page leads to it. */
  onOpenCharacter?: () => void
  /** The album's other cards, one step either way: buttons, a swipe beside the card, the arrows. */
  navigation?: CardNavigation
  onClose: () => void
}

export type CardNavigation = {
  /** From 0, among `total`. */
  index: number
  total: number
  /** The cards either side, whose pictures load ahead. */
  neighbours: EntityCardView[]
  onMove: (step: 1 | -1) => void
}

/** How far a card slides when the next one takes its place, in shares of the screen's width. */
const SLIDE = 0.55

const FLY_DURATION = 520
/** The card is gone this early in its flight: it only hints at where it goes. */
const FLY_FADE = 220
/** A card whose pictures never come shows without them after this wait. */
const READY_TIMEOUT = 8000
/** A card still loading after this long shows a spinner; one in the cache never does. */
const SPINNER_DELAY = 200

/**
 * A card large over the page (ADR-0090): it rises, tilts with the phone or the finger and turns
 * over at a touch. A new card enters the collection only with « Récupérer », then sets off toward
 * its place in the character's header and fades on the way; the place there takes over.
 */
export const CardSpotlight = ({
  card,
  mode,
  getLandingRect,
  onCollect,
  onLanded,
  onOpenCharacter,
  navigation,
  onClose,
}: CardSpotlightProps) => {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const { width: screenWidth, height: screenHeight } = useWindowDimensions()
  const reduceMotion = useReducedMotion()
  const cardWidth = Math.min(
    Math.round(screenWidth * 0.68),
    // The canvas is 1.68 times the card's width high, with its room; the title and the buttons
    // take about 200 points.
    Math.round((screenHeight - insets.top - insets.bottom - 200) / 1.68),
    320
  )
  const canvas = getEntityCardCanvasSize(cardWidth)
  const cardRef = useRef<View>(null)
  const [leaving, setLeaving] = useState(false)
  // A spinner holds the card's place while its font and pictures load, the first time above all.
  // Kept by the card it is for: the next card of the album, already in the cache, says it is ready
  // in its own effect, which runs before any effect of this overlay could reset a plain flag.
  const [readyCard, setReadyCard] = useState<string>()
  const ready = readyCard === card.id
  useEffect(() => {
    const id = card.id
    const timeout = setTimeout(() => setReadyCard(id), READY_TIMEOUT)
    return () => clearTimeout(timeout)
  }, [card.id])
  // The spinner waits a moment: a card in the cache says it is ready one frame after it is drawn,
  // and a spinner shown for that frame would flash at every card of the album.
  const [slowCard, setSlowCard] = useState<string>()
  useEffect(() => {
    const id = card.id
    const timeout = setTimeout(() => setSlowCard(id), SPINNER_DELAY)
    return () => clearTimeout(timeout)
  }, [card.id])
  const showsSpinner = !ready && slowCard === card.id

  const shade = useSharedValue(0)
  const rise = useSharedValue(reduceMotion ? 1 : 0)
  const chrome = useSharedValue(0)
  const halo = useSharedValue(0)
  const flyX = useSharedValue(0)
  const flyY = useSharedValue(0)
  const flyScale = useSharedValue(1)
  const fade = useSharedValue(1)
  // The slide from one card of the album to the next: out on one side, in from the other.
  const slide = useSharedValue(0)
  const slideFade = useSharedValue(1)
  const moving = useRef<1 | -1 | null>(null)
  const shownCard = useRef(card.id)

  useEffect(() => {
    if (navigation?.neighbours.length) prefetchCards(navigation.neighbours)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id])

  // A new card of the album arrives from the side it was asked from.
  useEffect(() => {
    if (shownCard.current === card.id) return
    shownCard.current = card.id
    const step = moving.current ?? 1
    moving.current = null
    if (reduceMotion) {
      slide.set(0)
      slideFade.set(withTiming(1, { duration: 180 }))
      return
    }
    slide.set(step * SLIDE * screenWidth)
    slideFade.set(0)
    slide.set(withSpring(0, { damping: 18, stiffness: 170, mass: 0.8 }))
    slideFade.set(withTiming(1, { duration: 220 }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id])

  /** A card lies that way in the album; a move under way is checked when it is asked. */
  const canMove = (step: 1 | -1) =>
    !!navigation &&
    !leaving &&
    navigation.index + step >= 0 &&
    navigation.index + step < navigation.total

  /** The card leaves on the side opposite to the step, then the album hands the next one. */
  const move = (step: 1 | -1) => {
    if (!navigation || !canMove(step) || moving.current !== null) return
    moving.current = step
    if (Platform.OS !== 'web') void Haptics.selectionAsync()
    const handOver = () => navigation.onMove(step)
    if (reduceMotion) {
      slideFade.set(
        withTiming(0, { duration: 140 }, finished => {
          if (finished) scheduleOnRN(handOver)
        })
      )
      return
    }
    slideFade.set(withTiming(0, { duration: 170 }))
    slide.set(
      withTiming(
        -step * SLIDE * screenWidth,
        { duration: 190, easing: Easing.in(Easing.quad) },
        finished => {
          if (finished) scheduleOnRN(handOver)
        }
      )
    )
  }

  // The arrows of a keyboard, on the Web and in the desktop app.
  useEffect(() => {
    if (Platform.OS !== 'web' || !navigation) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') move(1)
      if (event.key === 'ArrowLeft') move(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // A swipe beside the card moves through the album; on the card itself the finger tilts it.
  const swipe = Gesture.Pan()
    .runOnJS(true)
    .enabled(!!navigation)
    .activeOffsetX([-20, 20])
    .failOffsetY([-24, 24])
    .onEnd(event => {
      if (event.translationX < -50) move(1)
      else if (event.translationX > 50) move(-1)
    })

  useEffect(() => {
    shade.set(withTiming(1, { duration: 240 }))
    if (!reduceMotion) rise.set(withSpring(1, { damping: 14, stiffness: 120, mass: 0.9 }))
    chrome.set(withDelay(reduceMotion ? 0 : 260, withTiming(1, { duration: 280 })))
    if (mode === 'reveal') {
      if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      if (!reduceMotion) {
        halo.set(
          withSequence(
            withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }),
            withRepeat(
              withTiming(0.72, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
              -1,
              true
            )
          )
        )
      } else {
        halo.set(0.8)
      }
    }
  }, [shade, rise, chrome, halo, mode, reduceMotion])

  /** Everything fades together, the card sinking a little; `then` runs once it is gone. */
  const leave = (then?: () => void) => {
    if (leaving) return
    setLeaving(true)
    const done = () => {
      onClose()
      then?.()
    }
    chrome.set(withTiming(0, { duration: 160 }))
    halo.set(withTiming(0, { duration: 180 }))
    fade.set(withTiming(0, { duration: 220, easing: Easing.out(Easing.quad) }))
    if (!reduceMotion) rise.set(withTiming(0.85, { duration: 240, easing: Easing.in(Easing.quad) }))
    shade.set(
      withTiming(0, { duration: 260 }, finished => {
        if (finished) scheduleOnRN(done)
      })
    )
  }

  const collect = async () => {
    if (leaving || !ready) return
    setLeaving(true)
    if (Platform.OS !== 'web') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    }
    onCollect?.()
    const [landing, from] = await Promise.all([
      getLandingRect?.(),
      new Promise<WindowRect | undefined>(resolve => {
        if (!cardRef.current) return resolve(undefined)
        cardRef.current.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }))
      }),
    ])
    chrome.set(withTiming(0, { duration: 160 }))
    halo.set(withTiming(0, { duration: 200 }))
    if (!landing || !from || reduceMotion) {
      fade.set(withTiming(0, { duration: 220 }))
      shade.set(
        withTiming(0, { duration: 260 }, finished => {
          if (finished) scheduleOnRN(onClose)
        })
      )
      onLanded?.()
      return
    }
    // The card itself sits in the middle of its canvas, which leaves room for its turn.
    const easing = Easing.bezier(0.32, 0.72, 0, 1)
    flyX.set(
      withTiming(landing.x + landing.width / 2 - (from.x + from.width / 2), {
        duration: FLY_DURATION,
        easing,
      })
    )
    flyY.set(
      withTiming(landing.y + landing.height / 2 - (from.y + from.height / 2), {
        duration: FLY_DURATION,
        easing,
      })
    )
    flyScale.set(withTiming(landing.width / cardWidth, { duration: FLY_DURATION, easing }))
    fade.set(withTiming(0, { duration: FLY_FADE, easing: Easing.in(Easing.quad) }))
    setTimeout(() => onLanded?.(), FLY_FADE)
    shade.set(
      withTiming(0, { duration: FLY_FADE + 80 }, finished => {
        if (finished) scheduleOnRN(onClose)
      })
    )
  }

  /** A step through the album, either side of « Voir la fiche ». */
  const arrow = (step: 1 | -1) => {
    const enabled = canMove(step)
    return (
      <Pressable
        key={step}
        accessibilityRole="button"
        accessibilityLabel={t(step === 1 ? 'entityCards.next' : 'entityCards.previous')}
        accessibilityState={{ disabled: !enabled }}
        disabled={!enabled}
        hitSlop={8}
        onPress={() => move(step)}
        style={({ pressed }) => ({
          width: 40,
          height: 40,
          borderRadius: 999,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(246, 239, 224, 0.14)',
          opacity: !enabled ? 0.3 : pressed ? 0.6 : 1,
          transform: [{ scale: pressed ? 0.92 : 1 }],
        })}
      >
        <FeatherIcon
          name={step === 1 ? 'chevron-right' : 'chevron-left'}
          size={22}
          color="#f6efe0"
        />
      </Pressable>
    )
  }

  const shadeStyle = useAnimatedStyle(() => ({ opacity: shade.get() }))
  const chromeStyle = useAnimatedStyle(() => ({
    opacity: chrome.get(),
    transform: [{ translateY: (1 - chrome.get()) * 8 }],
  }))
  const haloStyle = useAnimatedStyle(() => ({
    opacity: halo.get(),
    transform: [{ scale: 0.7 + halo.get() * 0.5 }],
  }))
  const cardStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, rise.get() * 1.4) * fade.get() * slideFade.get(),
    transform: [
      { translateX: flyX.get() + slide.get() },
      { rotateZ: `${(slide.get() / screenWidth) * 10}deg` },
      { translateY: flyY.get() + (1 - rise.get()) * 140 },
      { scale: flyScale.get() * (0.82 + 0.18 * rise.get()) },
      { rotateZ: `${(1 - rise.get()) * -6}deg` },
    ],
  }))

  return (
    <AboveEverything onClose={() => leave()}>
      <GestureDetector gesture={swipe}>
        <Animated.View style={[StyleSheet.absoluteFill, shadeStyle]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={mode === 'reveal' ? t('entityCards.later') : t('entityCards.close')}
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(4, 6, 12, 0.9)' }]}
            onPress={() => leave()}
            disabled={leaving}
          />
        </Animated.View>
      </GestureDetector>

      <View
        pointerEvents="box-none"
        style={[
          StyleSheet.absoluteFill,
          {
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        {mode === 'reveal' && (
          <Animated.View pointerEvents="none" style={[{ alignItems: 'center' }, chromeStyle]}>
            <Text
              style={{
                color: '#f2c14e',
                fontSize: 12,
                fontWeight: '700',
                letterSpacing: 2.4,
                textTransform: 'uppercase',
              }}
            >
              {t('entityCards.newCard')}
            </Text>
          </Animated.View>
        )}

        <View
          pointerEvents="box-none"
          style={{
            width: canvas.width,
            height: canvas.height,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: mode === 'reveal' ? 4 : 0,
          }}
        >
          {mode === 'reveal' && (
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: 'absolute',
                  width: canvas.width * 1.5,
                  height: canvas.width * 1.5,
                  borderRadius: canvas.width,
                  // A new card is gold, as the dot that announced it.
                  ...backgroundImage(
                    'radial-gradient(circle, rgba(242, 193, 78, 0.5) 0%, rgba(242, 193, 78, 0) 62%)'
                  ),
                },
                haloStyle,
              ]}
            />
          )}
          {showsSpinner && (
            <ActivityIndicator
              color="#f2c14e"
              accessibilityLabel={t('Chargement...')}
              style={{ position: 'absolute' }}
            />
          )}
          <Animated.View ref={cardRef} collapsable={false} style={cardStyle}>
            <EntityCardCanvas
              key={card.id}
              card={card}
              width={cardWidth}
              onReady={() => setReadyCard(card.id)}
            />
          </Animated.View>
        </View>

        <Animated.View
          pointerEvents={leaving ? 'none' : 'box-none'}
          style={[{ alignItems: 'center', gap: 6, marginTop: 4 }, chromeStyle]}
        >
          {mode === 'reveal' ? (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: !ready }}
                disabled={!ready}
                onPress={collect}
                style={({ pressed }) => ({
                  borderRadius: 999,
                  opacity: !ready ? 0.45 : pressed ? 0.8 : 1,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                  boxShadow: ready ? '0 6px 18px rgba(242, 193, 78, 0.35)' : undefined,
                })}
              >
                {/* A light runs round the gold while the card waits to be taken. */}
                <ChromaRing
                  borderRadius={999}
                  borderWidth={3}
                  base="#8a6414"
                  glow="#fffbe8"
                  background="#f2c14e"
                  active={ready}
                >
                  <View
                    style={{
                      minWidth: 195,
                      alignItems: 'center',
                      paddingHorizontal: 26,
                      paddingVertical: 12,
                    }}
                  >
                    <Text style={{ color: '#2a1d05', fontSize: 17, fontWeight: '700' }}>
                      {t('entityCards.collect')}
                    </Text>
                  </View>
                </ChromaRing>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => leave()} style={{ padding: 10 }}>
                <Text style={{ color: 'rgba(246, 239, 224, 0.7)', fontSize: 15 }}>
                  {t('entityCards.later')}
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              {navigation && (
                <Text
                  accessibilityLabel={t('entityCards.position', {
                    index: navigation.index + 1,
                    total: navigation.total,
                  })}
                  style={{
                    color: 'rgba(246, 239, 224, 0.6)',
                    fontSize: 13,
                    fontVariant: ['tabular-nums'],
                    marginBottom: 4,
                  }}
                >
                  {navigation.index + 1} / {navigation.total}
                </Text>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                {navigation && arrow(-1)}
                {onOpenCharacter && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('entityCards.openCharacter', { name: card.name })}
                    onPress={() => leave(onOpenCharacter)}
                    style={({ pressed }) => ({
                      minWidth: 200,
                      alignItems: 'center',
                      paddingHorizontal: 28,
                      paddingVertical: 13,
                      borderRadius: 999,
                      backgroundColor: 'rgba(246, 239, 224, 0.14)',
                      opacity: pressed ? 0.75 : 1,
                    })}
                  >
                    <Text style={{ color: '#f6efe0', fontSize: 16, fontWeight: '700' }}>
                      {t('entityCards.openPage')}
                    </Text>
                  </Pressable>
                )}
                {navigation && arrow(1)}
              </View>
              <Pressable accessibilityRole="button" onPress={() => leave()} style={{ padding: 12 }}>
                <Text
                  style={{ color: 'rgba(246, 239, 224, 0.8)', fontSize: 16, fontWeight: '600' }}
                >
                  {t('entityCards.close')}
                </Text>
              </Pressable>
            </>
          )}
        </Animated.View>
      </View>
    </AboveEverything>
  )
}
