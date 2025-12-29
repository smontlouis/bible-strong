import React, { MutableRefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { viewportWidth, wp, wpUI } from '~helpers/utils'
import { mapRange, scrollViewHeight } from './constants'
import { interpolate, useDerivedValue, useSharedValue } from 'react-native-reanimated'

export const useTimeline = ({
  startYear,
  endYear,
  interval,
}: {
  startYear: number
  endYear: number
  interval: number
}) => {
  const { t } = useTranslation()
  const x = useSharedValue(viewportWidth)
  const y = useSharedValue(0)
  const { current: ratio } = React.useRef(100 / interval) // 1 year = 1px with ratio = 1
  const { current: scrollViewWidth } = React.useRef(Math.abs(startYear - endYear) * ratio)

  const width = scrollViewWidth + wp(100)
  const height = scrollViewHeight + 200

  const yearNow = new Date().getFullYear()
  const avJCString = t('avJC')
  const futurString = t('futur')

  const year = useDerivedValue(() => {
    const currentYearNb = Math.round(
      interpolate(x.get() * -1, [0, scrollViewWidth], [startYear, endYear], 'extend')
    )
    if (currentYearNb >= yearNow) {
      return futurString
    } else {
      const yearSuffix = currentYearNb >= 0 ? '' : avJCString
      return `${Math.abs(currentYearNb)} ${yearSuffix}`
    }
  })

  const lineX = useDerivedValue(() => {
    return interpolate(
      x.get(),
      [-width, -width + wpUI(100), 0, wpUI(100)],
      [-wpUI(100), 0, 0, wpUI(100)]
    )
  })

  const { current: yearRange }: MutableRefObject<[number, number]> = React.useRef([
    startYear,
    endYear,
  ])

  const { current: timelineWidth }: MutableRefObject<[number, number]> = React.useRef([
    0,
    scrollViewWidth,
  ])

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
      return isFixed || yearsToPx(yearRange[0] + year) < 200 ? 200 : yearsToPx(yearRange[0] + year)
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
