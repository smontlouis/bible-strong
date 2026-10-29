import {
  BIBLICAL_MAP_HEIGHT,
  BIBLICAL_MAP_HOLY_LAND,
  BIBLICAL_MAP_WHOLE,
  BIBLICAL_MAP_WIDTH,
  clampBiblicalMapView,
  fitBiblicalMapView,
  placeBiblicalMapLabels,
  type BiblicalMapPlace,
  type BiblicalMapView,
} from '@bible-strong/resource-domain/biblical-map'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated'
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Image as SvgImage,
  Path,
  Rect,
  Text,
} from 'react-native-svg'
import { scheduleOnRN } from 'react-native-worklets'

import Box, { HStack, TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import TextUI from '~common/ui/Text'
import { useTheme } from '~themes/ThemeProvider'
import { BIBLICAL_MAP_LAKES, BIBLICAL_MAP_LAND, BIBLICAL_MAP_RIVERS } from './biblicalMapGround'

// The places of the Bible on one map, in the projection and on the ground of the public atlas
// (ADR-0091). The window is a view in map units; a gesture moves the drawing as a picture, and the
// view is set again when the fingers lift, so that marks and names keep their size.

/** A tap within this many points of a place opens it. */
const TAP_RADIUS = 24
/** Paintings show once a degree spans about 220 points. */
const PICTURES_FROM = 2.2

type Props = {
  places: readonly BiblicalMapPlace[]
  /** The place the map is about: marked, named first, its painting always shown. */
  focus?: string
  /** Places brought forward, the others dimmed: the places of a chapter. */
  highlighted?: ReadonlySet<string>
  /** The region the map opens on; the Promised Land by default. */
  region?: BiblicalMapView
  /** Moves under the fingers and zooms with the buttons; otherwise a still picture. */
  interactive?: boolean
  onOpenPlace?: (uniqueName: string) => void
  style?: StyleProp<ViewStyle>
}

const BiblicalMap = ({
  places,
  focus,
  highlighted,
  region,
  interactive = false,
  onOpenPlace,
  style,
}: Props) => {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const [frame, setFrame] = useState<{ width: number; height: number }>()
  const [view, setView] = useState<BiblicalMapView>()
  const opening = region ?? BIBLICAL_MAP_HOLY_LAND
  const openingKey = `${opening.x}:${opening.y}:${opening.width}:${opening.height}`

  const aspect = frame ? frame.height / frame.width : 0.6
  // A new frame or a new region opens the map again on its region.
  useEffect(() => {
    if (frame) setView(clampBiblicalMapView(fitBiblicalMapView(opening, aspect), aspect))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame?.width, frame?.height, openingKey])

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    if (width && height && (width !== frame?.width || height !== frame?.height)) {
      setFrame({ width, height })
    }
  }

  // The gesture in progress, in screen points: the drawing moves and grows as a picture.
  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)
  const scale = useSharedValue(1)
  const startX = useSharedValue(0)
  const startY = useSharedValue(0)
  const startScale = useSharedValue(1)
  const focalX = useSharedValue(0)
  const focalY = useSharedValue(0)

  const viewRef = useRef(view)
  viewRef.current = view

  /** Turns the picture's move into a new view, then shows the drawing at rest again. */
  const commit = (moveX: number, moveY: number, grow: number) => {
    const current = viewRef.current
    if (!current || !frame) return
    const unit = current.width / frame.width
    const width = current.width / grow
    setView(
      clampBiblicalMapView(
        {
          x: current.x - (moveX * unit) / grow,
          y: current.y - (moveY * unit) / grow,
          width,
          height: width * aspect,
        },
        aspect
      )
    )
    translateX.value = 0
    translateY.value = 0
    scale.value = 1
  }

  const openAt = (pointX: number, pointY: number) => {
    const current = viewRef.current
    if (!current || !frame || !onOpenPlace) return
    const unit = current.width / frame.width
    const x = current.x + pointX * unit
    const y = current.y + pointY * unit
    // Among the places under the finger, the one drawn on top: the place in focus, a place
    // brought forward, a painting, then the most named. Mount Moriah lies under Jerusalem.
    const rank = (place: BiblicalMapPlace) => [
      Number(place.uniqueName === focus),
      Number(highlighted?.has(place.uniqueName) ?? false),
      Number(thumbRadius(place) !== undefined),
      place.chapterCount,
    ]
    const touched = places.filter(
      place =>
        Math.hypot(place.x - x, place.y - y) < Math.max(thumbRadius(place) ?? 0, TAP_RADIUS) * unit
    )
    const chosen = touched.sort((left, right) => {
      const [a, b] = [rank(left), rank(right)]
      return b[0] - a[0] || b[1] - a[1] || b[2] - a[2] || b[3] - a[3]
    })[0]
    if (chosen) onOpenPlace(chosen.uniqueName)
  }

  const pan = Gesture.Pan()
    .maxPointers(1)
    .onStart(() => {
      startX.value = translateX.value
      startY.value = translateY.value
    })
    .onUpdate(event => {
      translateX.value = startX.value + event.translationX
      translateY.value = startY.value + event.translationY
    })
    .onEnd(() => {
      scheduleOnRN(commit, translateX.value, translateY.value, scale.value)
    })
  // The point between the fingers stays under them while they part or close.
  const pinch = Gesture.Pinch()
    .onStart(event => {
      startScale.value = scale.value
      startX.value = translateX.value
      startY.value = translateY.value
      focalX.value = event.focalX
      focalY.value = event.focalY
    })
    .onUpdate(event => {
      const next = startScale.value * event.scale
      const ratio = next / startScale.value
      scale.value = next
      translateX.value = event.focalX - (focalX.value - startX.value) * ratio
      translateY.value = event.focalY - (focalY.value - startY.value) * ratio
    })
    .onEnd(() => {
      scheduleOnRN(commit, translateX.value, translateY.value, scale.value)
    })
  const tap = Gesture.Tap().onEnd(event => {
    scheduleOnRN(openAt, event.x, event.y)
  })
  const gesture = Gesture.Race(pinch, pan, tap)

  const pictureStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }))

  const zoom = (factor: number) => {
    const current = viewRef.current
    if (!current) return
    const width = current.width * factor
    setView(
      clampBiblicalMapView(
        {
          x: current.x + (current.width - width) / 2,
          y: current.y + (current.height - width * aspect) / 2,
          width,
          height: width * aspect,
        },
        aspect
      )
    )
  }

  const unit = view && frame ? view.width / frame.width : 1
  const showPictures = 1 / unit >= PICTURES_FROM
  const thumbRadius = (place: BiblicalMapPlace) =>
    place.picture && (place.uniqueName === focus || showPictures)
      ? place.uniqueName === focus
        ? 24
        : 16
      : undefined
  // Only the places in the window, with a margin, and the place in focus drawn last.
  const visible = useMemo(
    () =>
      view
        ? places
            .filter(
              place =>
                place.x >= view.x - 40 * unit &&
                place.x <= view.x + view.width + 40 * unit &&
                place.y >= view.y - 40 * unit &&
                place.y <= view.y + view.height + 40 * unit
            )
            .sort(
              (left, right) =>
                Number(left.uniqueName === focus) - Number(right.uniqueName === focus) ||
                Number(highlighted?.has(left.uniqueName) ?? false) -
                  Number(highlighted?.has(right.uniqueName) ?? false)
            )
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [places, view, focus, highlighted]
  )
  const labelled = useMemo(
    () =>
      placeBiblicalMapLabels({
        // Highlighted places are named first, as the place in focus is.
        places: highlighted?.size
          ? visible.map(place =>
              highlighted.has(place.uniqueName)
                ? { ...place, chapterCount: place.chapterCount + 10_000 }
                : place
            )
          : visible,
        unit,
        focus,
        thumbRadius,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visible, unit, focus, highlighted]
  )

  const water = colors.primary
  const dimmed = (place: BiblicalMapPlace) =>
    Boolean(highlighted?.size) && !highlighted?.has(place.uniqueName)

  const drawing = view && frame && (
    <Svg
      width={frame.width}
      height={frame.height}
      viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
    >
      <Rect
        x={-BIBLICAL_MAP_WIDTH}
        y={-BIBLICAL_MAP_HEIGHT}
        width={BIBLICAL_MAP_WIDTH * 3}
        height={BIBLICAL_MAP_HEIGHT * 3}
        fill={colors.lightPrimary}
      />
      <Path
        d={BIBLICAL_MAP_LAND}
        fill={colors.surface}
        stroke={colors.separator}
        strokeWidth={unit}
      />
      <Path d={BIBLICAL_MAP_LAKES} fill={water} fillOpacity={0.35} />
      <Path
        d={BIBLICAL_MAP_RIVERS}
        fill="none"
        stroke={water}
        strokeOpacity={0.45}
        strokeWidth={1.4 * unit}
      />
      <Defs>
        {visible.map((place, index) => {
          const radius = thumbRadius(place)
          return radius ? (
            <ClipPath key={place.uniqueName} id={`place-${index}`}>
              <Circle cx={place.x} cy={place.y} r={radius * unit} />
            </ClipPath>
          ) : null
        })}
      </Defs>
      {visible.map((place, index) => {
        const radius = thumbRadius(place)
        const isFocus = place.uniqueName === focus
        const isHighlighted = highlighted?.has(place.uniqueName) ?? false
        const fade = dimmed(place) ? 0.35 : 1
        return (
          <G key={place.uniqueName} opacity={fade}>
            {radius && place.picture ? (
              <>
                <Circle
                  cx={place.x}
                  cy={place.y}
                  r={(radius + 1.5) * unit}
                  fill={isFocus || isHighlighted ? colors.primary : colors.surface}
                />
                <SvgImage
                  href={{ uri: place.picture }}
                  x={place.x - radius * unit}
                  y={place.y - radius * unit}
                  width={radius * 2 * unit}
                  height={radius * 2 * unit}
                  preserveAspectRatio="xMidYMid slice"
                  clipPath={`url(#place-${index})`}
                />
              </>
            ) : (
              <Circle
                cx={place.x}
                cy={place.y}
                r={(isFocus ? 7 : isHighlighted ? 5.5 : place.chapterCount >= 20 ? 4 : 3) * unit}
                fill={isFocus || isHighlighted ? colors.primary : colors.tertiary}
                stroke={colors.surface}
                strokeWidth={1.5 * unit}
              />
            )}
            {labelled.has(place.uniqueName) && (
              <>
                <Text
                  x={place.x}
                  y={place.y + ((radius ?? 2) + 13) * unit}
                  fontSize={(isFocus ? 14 : 12) * unit}
                  fontWeight="600"
                  textAnchor="middle"
                  stroke={colors.surface}
                  strokeWidth={3 * unit}
                  strokeLinejoin="round"
                  fill={colors.surface}
                >
                  {place.name}
                </Text>
                <Text
                  x={place.x}
                  y={place.y + ((radius ?? 2) + 13) * unit}
                  fontSize={(isFocus ? 14 : 12) * unit}
                  fontWeight="600"
                  textAnchor="middle"
                  fill={colors.default}
                >
                  {place.name}
                </Text>
              </>
            )}
          </G>
        )
      })}
    </Svg>
  )

  return (
    <Box
      className="overflow-hidden border-continuous"
      style={[{ backgroundColor: colors.lightPrimary }, style]}
      onLayout={onLayout}
      accessibilityRole={interactive ? 'adjustable' : 'image'}
      accessibilityLabel={t('strongDetail.entity.mapLabel')}
    >
      {interactive ? (
        <GestureDetector gesture={gesture}>
          <Animated.View
            style={[StyleSheet.absoluteFill, pictureStyle, { transformOrigin: '0% 0%' }]}
          >
            {drawing}
          </Animated.View>
        </GestureDetector>
      ) : (
        drawing
      )}
      {interactive && (
        <HStack
          className="overflow-hidden border-continuous gap-[8px]"
          style={{ position: 'absolute', right: 12, bottom: 12 }}
        >
          {[
            {
              icon: 'plus' as const,
              label: t('strongDetail.entity.mapZoomIn'),
              press: () => zoom(0.6),
            },
            {
              icon: 'minus' as const,
              label: t('strongDetail.entity.mapZoomOut'),
              press: () => zoom(1 / 0.6),
            },
          ].map(control => (
            <TouchableBox
              key={control.icon}
              className="overflow-hidden border-continuous bg-surface-raised rounded-full items-center justify-center"
              style={{ width: 40, height: 40 }}
              onPress={control.press}
              accessibilityRole="button"
              accessibilityLabel={control.label}
            >
              <FeatherIcon name={control.icon} size={18} />
            </TouchableBox>
          ))}
          <TouchableBox
            className="overflow-hidden border-continuous bg-surface-raised rounded-full items-center justify-center px-[14px]"
            style={{ height: 40 }}
            onPress={() =>
              setView(clampBiblicalMapView(fitBiblicalMapView(BIBLICAL_MAP_WHOLE, aspect), aspect))
            }
            accessibilityRole="button"
          >
            <TextUI className="text-[13px] font-semibold">
              {t('strongDetail.entity.mapWhole')}
            </TextUI>
          </TouchableBox>
        </HStack>
      )}
    </Box>
  )
}

export default BiblicalMap
