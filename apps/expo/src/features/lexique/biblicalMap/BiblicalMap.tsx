import {
  BIBLICAL_MAP_HEIGHT,
  BIBLICAL_MAP_HOLY_LAND,
  BIBLICAL_MAP_WIDTH,
  clampBiblicalMapView,
  fitBiblicalMapView,
  placeBiblicalMapLabels,
  type BiblicalMapPlace,
  type BiblicalMapView,
} from '@bible-strong/resource-domain/biblical-map'
import {
  BIBLICAL_MAP_LAKES,
  BIBLICAL_MAP_LAND,
  BIBLICAL_MAP_RIVERS,
} from '@bible-strong/biblical-map/ground-paths'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native'
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

import Box from '~common/ui/Box'
import { useTheme } from '~themes/ThemeProvider'

// A place and its neighbours on a still map, in the projection and on the ground of the public
// atlas (ADR-0091). The map travelled with the fingers is the atlas's own, in a web view
// (BiblicalMapDOM): react-native-svg cannot redraw it on every move.

/** Paintings show once a degree spans about 220 points. */
const PICTURES_FROM = 2.2

type Props = {
  places: readonly BiblicalMapPlace[]
  /** The place the map is about: marked, named first, its painting always shown. */
  focus?: string
  /** Places brought forward, the others dimmed: the places of a chapter. */
  highlighted?: ReadonlySet<string>
  /** The region the map shows; the Promised Land by default. */
  region?: BiblicalMapView
  style?: StyleProp<ViewStyle>
}

const BiblicalMap = ({ places, focus, highlighted, region, style }: Props) => {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const [frame, setFrame] = useState<{ width: number; height: number }>()
  const opening = region ?? BIBLICAL_MAP_HOLY_LAND

  const openingKey = `${opening.x}:${opening.y}:${opening.width}:${opening.height}`
  const view = useMemo(
    () =>
      frame
        ? clampBiblicalMapView(
            fitBiblicalMapView(opening, frame.height / frame.width),
            frame.height / frame.width
          )
        : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [frame?.width, frame?.height, openingKey]
  )

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    if (width && height && (width !== frame?.width || height !== frame?.height)) {
      setFrame({ width, height })
    }
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
      accessibilityRole="image"
      accessibilityLabel={t('strongDetail.entity.mapLabel')}
    >
      {drawing}
    </Box>
  )
}

export default BiblicalMap
