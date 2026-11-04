import {
  TIMELINE_CARD_HEIGHT,
  TIMELINE_PILL_HEIGHT,
  TIMELINE_RULER_HEIGHT,
  timelineYearToX,
} from '@bible-strong/resource-domain/timeline-stage'
import { useIsFocused } from 'expo-router'
import { useFonts } from 'expo-font'
import { useAtom, useAtomValue } from 'jotai/react'
import { startTransition, useEffect, useEffectEvent, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Platform, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDecay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import Box, { usePageBottomInset } from '~common/ui/Box'
import Button from '~common/ui/Button'
import Text from '~common/ui/Text'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import { useTimelineDetails } from './TimelineResourceBoundary'
import { PeriodName, PeriodScene, PeriodTint, SERIF, StageYear } from './TimelineStageBackdrop'
import TimelineStageEvents from './TimelineStageEvents'
import TimelineStageRuler from './TimelineStageRuler'
import TimelineStageStrip from './TimelineStageStrip'
import { timelineShownEventAtom, timelineUnderSheetAtom } from './timelineStageAtoms'
import {
  extentIndexAt,
  getTimelineStageDrawing,
  GLIDE_DECELERATION,
  glideDistance,
  rubberBand,
  rubberBandPull,
  stageYearLabel,
  stageYearNumber,
  timelineEventsWithin,
  timelineYearWords,
  yearAtPosition,
  type TimelineStageEvent,
} from './timelineStageModel'
import { useTimelineStageWheel } from './useTimelineStageWheel'

/** Where the stage opens: on an event, at the start of a period, on a year, or at its opening. */
export type TimelineStageStart = { event?: string; period?: string; year?: number }

/** Where the middle of the view stands, as a timeline tab remembers it. */
export type TimelineStagePosition = { period?: string; year: number }

type Props = {
  language: ResourceLanguage
  start?: TimelineStageStart
  /** Opens an event in its sheet. */
  onOpenEvent: (slug: string) => void
  onPositionChange?: (position: TimelineStagePosition) => void
}

/** An event comes to this share of the view from its left edge. */
const EVENT_ANCHOR = 0.3
// On an iPhone the sheet of an event first covers the lower part of the screen (the first detent
// of the explore sheets, in FullAppRuntime): the event is shown in the part above it, the
// timeline rising off its axis if it has to.
const SHEET_COVERS_VIEW = Platform.OS === 'ios' && !Platform.isPad
const SHEET_SHARE = 0.45
const TRAVEL = { duration: 700, easing: Easing.out(Easing.cubic) }

const clamp = (value: number, min: number, max: number) => {
  'worklet'
  return Math.min(Math.max(value, min), max)
}

// A stage let go past its edge comes back to it; one thrown toward its edge carries its speed
// into it and settles there. Both without a bounce.
const EDGE_RETURN = { dampingRatio: 1, duration: 450 }
const EDGE_ARRIVAL = { dampingRatio: 1, duration: 650 }

/**
 * Where the stage goes once the finger lets go: it glides on and slows down by itself, or, when
 * the glide would take it past an edge or it is already past one, it settles on that edge.
 */
const letGo = (position: SharedValue<number>, velocity: number, min: number, max: number) => {
  'worklet'
  const current = position.get()
  if (current < min || current > max) {
    position.set(withSpring(clamp(current, min, max), { ...EDGE_RETURN, velocity }))
    return
  }
  const rest = current + glideDistance(velocity)
  if (rest < min || rest > max) {
    position.set(withSpring(clamp(rest, min, max), { ...EDGE_ARRIVAL, velocity }))
    return
  }
  position.set(withDecay({ velocity, deceleration: GLIDE_DECELERATION }))
}

const Stage = ({
  language,
  start,
  onOpenEvent,
  onPositionChange,
  width,
  height,
}: Props & { width: number; height: number }) => {
  const { t } = useTranslation()
  const details = useTimelineDetails()
  const reduceMotion = useReducedMotion()
  const bottomInset = usePageBottomInset()
  const isFocused = useIsFocused()
  const shown = useAtomValue(timelineShownEventAtom)
  const [underSheet, setUnderSheet] = useAtom(timelineUnderSheetAtom)
  const stageRef = useRef<View>(null)
  const windowHeight = useWindowDimensions().height

  const compact = width < 720
  const stripHeight = compact ? 52 : 58
  const worldHeight = height - stripHeight - bottomInset
  const lanesHeight = worldHeight - TIMELINE_RULER_HEIGHT
  const introWidth = Math.min(Math.max(width, 320), 600)
  const outroWidth = Math.min(width, 520)
  const nameWidth = Math.min(compact ? 320 : 400, width - (compact ? 24 : 40))

  const model = getTimelineStageDrawing(details, { introWidth, outroWidth, language })
  const labels = model.tickLabels
  // Worklets take what they need by value: the height alone, never the whole drawing.
  const drawingHeight = model.height
  const maxScroll = Math.max(model.width - width, 0)
  // Above its highest lane the stage keeps the room of the period's card, which would cover it.
  const nameRoom = compact ? 110 : 180
  const maxLift = Math.max(model.height + nameRoom - lanesHeight, 0)
  // How far the timeline may rise off its axis to show an event above the sheet.
  const sheetFloor = SHEET_COVERS_VIEW ? -windowHeight * SHEET_SHARE : 0
  const { bands, extents } = model

  // Where an event stands when the view comes to it.
  const placeOf = (event: TimelineStageEvent, sheet: boolean) => {
    const middle = event.top + (event.card ? TIMELINE_CARD_HEIGHT : TIMELINE_PILL_HEIGHT) / 2
    const y = lanesHeight * (sheet && SHEET_COVERS_VIEW ? EVENT_ANCHOR : 0.5)
    return {
      x: clamp(event.left - width * EVENT_ANCHOR, 0, maxScroll),
      lift: clamp(y - lanesHeight + model.height - middle, sheet ? sheetFloor : 0, maxLift),
    }
  }

  const startAt = (() => {
    const event = start?.event ? model.events.find(item => item.slug === start.event) : undefined
    if (event) return placeOf(event, false)
    const extent = start?.period ? extents.find(item => item.id === start.period) : undefined
    if (extent) return { x: clamp(extent.left, 0, maxScroll), lift: 0 }
    if (start?.year !== undefined) {
      return { x: clamp(timelineYearToX(bands, start.year) - width / 2, 0, maxScroll), lift: 0 }
    }
    return { x: 0, lift: 0 }
  })()

  const scrollX = useSharedValue(startAt.x)
  const lift = useSharedValue(startAt.lift)
  const panFrom = useSharedValue({ x: 0, lift: 0 })
  // The lowest the lanes may go: under the axis only while a sheet covers it.
  const liftFloor = useSharedValue(0)
  const [selected, setSelected] = useState(start?.event)

  // Only what is near the view is drawn: the view moves by whole screens between redraws, which
  // give way to the movement rather than hold it up.
  const [chunk, setChunk] = useState(() => Math.floor(startAt.x / width))
  const changeChunk = (next: number) => startTransition(() => setChunk(next))
  useAnimatedReaction(
    () => Math.floor(scrollX.get() / width),
    (current, previous) => {
      if (current !== previous) scheduleOnRN(changeChunk, current)
    }
  )
  const near = { from: (chunk - 1) * width, to: (chunk + 2) * width }

  // The year under the middle of the view is written by the UI thread, at every frame; the
  // period is state, and changes only from one period to the next.
  const year = useDerivedValue(() => yearAtPosition(bands, scrollX.get() + width / 2))
  const initialYear = yearAtPosition(bands, startAt.x + width / 2)
  const words = timelineYearWords(language)
  const cursorFormat = (value: number) => {
    'worklet'
    return stageYearLabel(value, words)
  }
  const [periodIndex, setPeriodIndex] = useState(() =>
    extentIndexAt(extents, startAt.x + width / 2)
  )
  const changePeriod = (next: number) => startTransition(() => setPeriodIndex(next))
  useAnimatedReaction(
    () => extentIndexAt(extents, scrollX.get() + width / 2),
    (current, previous) => {
      if (current !== previous) scheduleOnRN(changePeriod, current)
    }
  )
  const currentPeriod = extents[periodIndex]?.id
  const inTime = periodIndex !== -1

  // Whoever keeps the position (a tab) hears of it without the stage rendering.
  const positionListener = useRef(onPositionChange)
  useEffect(() => {
    positionListener.current = onPositionChange
  })
  const reportPosition = (value: number, index: number) =>
    positionListener.current?.({ period: extents[index]?.id, year: value })
  useAnimatedReaction(
    () => ({
      year: yearAtPosition(bands, scrollX.get() + width / 2),
      period: extentIndexAt(extents, scrollX.get() + width / 2),
    }),
    (current, previous) => {
      if (current.year !== previous?.year || current.period !== previous?.period) {
        scheduleOnRN(reportPosition, current.year, current.period)
      }
    }
  )

  const travel = (x: number, toLift?: number, floor = 0) => {
    const target = clamp(x, 0, maxScroll)
    scrollX.set(reduceMotion ? target : withTiming(target, TRAVEL))
    if (toLift !== undefined) {
      const liftTarget = clamp(toLift, floor, maxLift)
      lift.set(reduceMotion ? liftTarget : withTiming(liftTarget, TRAVEL))
    }
  }

  const locate = (slug: string) => {
    const event = model.events.find(item => item.slug === slug)
    if (!event) return
    setSelected(slug)
    liftFloor.set(sheetFloor)
    const place = placeOf(event, true)
    travel(place.x, place.lift, sheetFloor)
  }

  const openEvent = (event: TimelineStageEvent) => {
    locate(event.slug)
    setUnderSheet(true)
    onOpenEvent(event.slug)
  }

  // The sheet opened over the timeline walks to other events: the view goes with it.
  const follow = useEffectEvent((slug: string) => {
    if (underSheet && slug !== selected) locate(slug)
  })
  useEffect(() => {
    if (shown) follow(shown.slug)
  }, [shown])

  // Back on the stage, the event that was open lets go.
  const settle = useEffectEvent(() => {
    if (!underSheet) return
    setUnderSheet(false)
    setSelected(undefined)
    // The timeline comes back down onto its axis.
    liftFloor.set(0)
    if (lift.get() < 0) lift.set(reduceMotion ? 0 : withTiming(0, TRAVEL))
  })
  useEffect(() => {
    if (isFocused) settle()
  }, [isFocused])

  useTimelineStageWheel(stageRef, distance => {
    cancelAnimation(scrollX)
    scrollX.set(clamp(scrollX.get() + distance, 0, maxScroll))
  })

  const pan = Gesture.Pan()
    .onBegin(() => {
      // A finger on the stage stops it where it is.
      cancelAnimation(scrollX)
      cancelAnimation(lift)
    })
    .onStart(() => {
      // Caught past an edge, the stage goes on from the pull that put it there.
      panFrom.set({
        x: rubberBandPull(scrollX.get(), 0, maxScroll, width),
        lift: rubberBandPull(lift.get(), liftFloor.get(), maxLift, lanesHeight),
      })
    })
    .onUpdate(event => {
      scrollX.set(rubberBand(panFrom.get().x - event.translationX, 0, maxScroll, width))
      lift.set(
        rubberBand(panFrom.get().lift + event.translationY, liftFloor.get(), maxLift, lanesHeight)
      )
    })
    .onEnd(event => {
      letGo(scrollX, -event.velocityX, 0, maxScroll)
      letGo(lift, event.velocityY, liftFloor.get(), maxLift)
    })
    .onFinalize((_event, dragged) => {
      // A touch that stopped the stage on its way back from an edge lets it go on back.
      if (dragged) return
      letGo(scrollX, 0, 0, maxScroll)
      letGo(lift, 0, liftFloor.get(), maxLift)
    })

  const alongAxis = useAnimatedStyle(() => ({ transform: [{ translateX: -scrollX.get() }] }))
  const inWorld = useAnimatedStyle(() => ({
    transform: [
      { translateX: -scrollX.get() },
      { translateY: lanesHeight - drawingHeight + lift.get() },
    ],
  }))

  const nearExtents = extents.filter(
    extent => extent.left < near.to && extent.left + extent.width > near.from
  )
  const nearTicks = model.ticks.flatMap((tick, index) =>
    tick.left >= near.from - 80 && tick.left <= near.to + 80
      ? [{ ...tick, label: labels[index] }]
      : []
  )
  const firstPeriodStart = extents[0]?.left ?? 0

  return (
    <View ref={stageRef} style={{ flex: 1 }}>
      <GestureDetector gesture={pan}>
        <View
          accessibilityLabel={t('timeline.stage.hint')}
          style={{ height: worldHeight, overflow: 'hidden' }}
        >
          {nearExtents.map(extent => (
            <PeriodScene
              key={extent.id}
              extent={extent}
              visible={extent.id === currentPeriod}
              viewWidth={width}
              height={worldHeight}
            />
          ))}

          {/* Over the scenes: a scene fades into the plain ground, which the tint then covers. */}
          <Animated.View
            pointerEvents="none"
            style={[
              { position: 'absolute', top: 0, left: 0, width: model.width, height: worldHeight },
              alongAxis,
            ]}
          >
            {nearExtents.map(extent => (
              <PeriodTint key={extent.id} extent={extent} />
            ))}
          </Animated.View>

          <StageYear
            year={year}
            initial={stageYearNumber(initialYear)}
            visible={inTime}
            viewWidth={width}
            viewHeight={worldHeight}
          />

          {/* Layers as wide as the timeline: only what they hold takes a touch. */}
          <Animated.View
            pointerEvents="box-none"
            style={[
              { position: 'absolute', top: 0, left: 0, width: model.width, height: lanesHeight },
              alongAxis,
            ]}
          >
            {near.from < introWidth && (
              <Box
                pointerEvents="box-none"
                className="absolute top-[0px] bottom-[0px] justify-center gap-[18px] px-[24px]"
                style={{ left: 0, width: introWidth }}
              >
                <Text className="text-[11px] font-semibold uppercase tracking-[1.8px] text-grey">
                  {t('timeline.stage.introEyebrow')}
                </Text>
                <Text style={{ fontFamily: SERIF, fontSize: 40, lineHeight: 44 }}>
                  {t('La Chronologie biblique')}
                </Text>
                <Text className="text-[16px] leading-[25px] text-grey">
                  {t('timeline.stage.introLead', { count: details.length })}
                </Text>
                <Box className="items-start">
                  <Button onPress={() => travel(firstPeriodStart)}>
                    {t('timeline.stage.introStart')}
                  </Button>
                </Box>
              </Box>
            )}
            {near.to > model.axisEnd && (
              <Box
                pointerEvents="box-none"
                className="absolute top-[0px] bottom-[0px] justify-center gap-[14px] px-[24px]"
                style={{ left: model.axisEnd, width: outroWidth }}
              >
                <Text style={{ fontFamily: SERIF, fontSize: 30, lineHeight: 34 }}>
                  {t('timeline.stage.outroTitle')}
                </Text>
                <Text className="text-[16px] leading-[25px] text-grey">
                  {t('timeline.stage.outroLead')}
                </Text>
                <Box className="items-start">
                  <Button secondary onPress={() => travel(firstPeriodStart)}>
                    {t('timeline.stage.outroRestart')}
                  </Button>
                </Box>
              </Box>
            )}
          </Animated.View>

          <Animated.View
            pointerEvents="box-none"
            style={[
              { position: 'absolute', top: 0, left: 0, width: model.width, height: model.height },
              inWorld,
            ]}
          >
            <TimelineStageEvents
              events={timelineEventsWithin(model.events, near.from, near.to)}
              language={language}
              selected={selected}
              scrollX={scrollX}
              onPress={openEvent}
            />
          </Animated.View>

          {nearExtents.map(extent => (
            <PeriodName
              key={extent.id}
              extent={extent}
              number={extents.indexOf(extent) + 1}
              language={language}
              scrollX={scrollX}
              width={nameWidth}
              compact={compact}
            />
          ))}

          <TimelineStageRuler
            extents={extents}
            ticks={nearTicks}
            scrollX={scrollX}
            year={year}
            cursorFormat={cursorFormat}
            cursorInitial={stageYearLabel(initialYear, words)}
            inTime={inTime}
          />
        </View>
      </GestureDetector>

      <View style={{ paddingBottom: bottomInset }}>
        <TimelineStageStrip
          extents={extents}
          language={language}
          scrollX={scrollX}
          viewWidth={width}
          maxScroll={maxScroll}
          height={stripHeight}
          current={currentPeriod}
          onPeriodPress={id => {
            const extent = extents.find(item => item.id === id)
            if (extent) travel(extent.left)
          }}
        />
      </View>
    </View>
  )
}

/**
 * The timeline as a place to travel, as on the public site: one axis running through the
 * thirteen periods, each with its scene, and every event on a lane above it. It moves like a
 * map; an event opens in its sheet, and the view follows the sheet from event to event.
 */
const TimelineStage = ({ start, onPositionChange, ...props }: Props) => {
  useFonts({ 'Literata Book': require('~assets/fonts/LiterataBook-Regular.otf') })
  const [size, setSize] = useState<{ width: number; height: number }>()
  // A new size draws a new stage, since the opening and the lanes depend on it: it opens on
  // the year the previous one was showing.
  const [resume, setResume] = useState<TimelineStageStart>()
  const shownYear = useRef<number>(undefined)
  const onLayout = ({ nativeEvent: { layout } }: LayoutChangeEvent) => {
    if (size && (size.width !== layout.width || size.height !== layout.height)) {
      setResume(shownYear.current === undefined ? undefined : { year: shownYear.current })
    }
    setSize(current =>
      current?.width === layout.width && current.height === layout.height
        ? current
        : { width: layout.width, height: layout.height }
    )
  }
  return (
    <View style={{ flex: 1 }} onLayout={onLayout}>
      {!!size && size.width > 0 && size.height > 0 && (
        <Stage
          key={`${size.width}x${size.height}`}
          {...props}
          {...size}
          start={resume ?? start}
          onPositionChange={position => {
            // Before the first year or after the last, it opens where it starts.
            shownYear.current = position.period ? position.year : undefined
            onPositionChange?.(position)
          }}
        />
      )}
    </View>
  )
}

export default TimelineStage
