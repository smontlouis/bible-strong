import { useTranslation } from 'react-i18next'
import { viewportWidth, wp, wpUI } from '~helpers/utils'
import { mapRange, offset, scrollViewHeight } from './constants'
import {
  Extrapolation,
  interpolate,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated'

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
  const ratio = 100 / interval // 1 year = 1px with ratio = 1
  const scrollViewWidth = Math.abs(startYear - endYear) * ratio

  const width = scrollViewWidth + wp(100)
  const height = scrollViewHeight + 200

  const yearNow = new Date().getFullYear()
  const avJCString = t('avJC')
  const futurString = t('futur')

  const lineX = useDerivedValue(() => {
    return interpolate(
      x.get(),
      [-width, -width + wpUI(100), 0, wpUI(100)],
      [-wpUI(100), 0, 0, wpUI(100)]
    )
  })

  const year = useDerivedValue(() => {
    const currentTimelineX = offset + lineX.get() - x.get()
    const currentYearNb = Math.round(
      interpolate(currentTimelineX, [0, scrollViewWidth], [startYear, endYear], Extrapolation.CLAMP)
    )

    if (currentYearNb >= yearNow) {
      return futurString
    } else {
      const yearSuffix = currentYearNb >= 0 ? '' : avJCString
      return `${Math.abs(currentYearNb)} ${yearSuffix}`
    }
  })

  const yearRange: [number, number] = [startYear, endYear]
  const timelineWidth: [number, number] = [0, scrollViewWidth]

  const yearsToPx = (years: number) => Math.round(mapRange(years, yearRange, timelineWidth))

  const pxToYears = (pixels: number) => Math.round(mapRange(pixels, timelineWidth, yearRange))

  const calculateEventWidth = (yearStart: number, yearEnd: number, isFixed?: boolean) => {
    const year = Math.abs(yearStart - yearEnd)
    return isFixed || yearsToPx(yearRange[0] + year) < 200 ? 200 : yearsToPx(yearRange[0] + year)
  }

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
