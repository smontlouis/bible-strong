import React, { MutableRefObject } from 'react'
import { useValues } from 'react-native-redash'
import { mapRange, scrollViewHeight } from './constants'
import {
  useCode,
  call,
  concat,
  abs,
  round,
  interpolate,
  multiply,
  Extrapolate,
  lessOrEq,
  cond,
  greaterOrEq,
} from 'react-native-reanimated'
import { wp } from '~helpers/utils'

export const useTimeline = ({
  startYear,
  endYear,
  interval,
}: {
  startYear: number
  endYear: number
  interval: number
}) => {
  const [x, y] = useValues([4000, 0], [])
  const { current: ratio } = React.useRef(100 / interval) // 1 year = 1px with ratio = 1
  const { current: scrollViewWidth } = React.useRef(
    Math.abs(startYear - endYear) * ratio
  )

  const width = scrollViewWidth + wp(100)
  const height = scrollViewHeight + 200

  const yearNb = round(
    interpolate(multiply(x, -1), {
      inputRange: [0, scrollViewWidth],
      outputRange: [startYear, endYear],
      extrapolate: Extrapolate.EXTEND,
    })
  )

  const year = concat(abs(yearNb), cond(greaterOrEq(yearNb, 0), '', ' av.JC'))

  const lineX = interpolate(x, {
    inputRange: [-width, -width + wp(100), 0, wp(100)],
    outputRange: [-wp(100), 0, 0, wp(100)],
  })

  const {
    current: yearRange,
  }: MutableRefObject<[number, number]> = React.useRef([startYear, endYear])

  const {
    current: timelineWidth,
  }: MutableRefObject<[number, number]> = React.useRef([0, scrollViewWidth])

  const yearsToPx = React.useCallback(
    (years: number) => Math.round(mapRange(years, yearRange, timelineWidth)),
    [yearRange, timelineWidth]
  )

  const pxToYears = React.useCallback(
    (pixels: number) => Math.round(mapRange(pixels, timelineWidth, yearRange)),
    [yearRange, timelineWidth]
  )

  const calculateEventWidth = React.useCallback(
    (yearStart: number, yearEnd: number, isFixed?: boolean) => {
      const year = Math.abs(yearStart - yearEnd)
      return isFixed || yearsToPx(yearRange[0] + year) < 200
        ? 200
        : yearsToPx(yearRange[0] + year)
    },
    [yearRange, yearsToPx]
  )

  return {
    x,
    y,
    lineX,
    year,
    width,
    height,
    yearsToPx,
    pxToYears,
    calculateEventWidth,
  }
}
