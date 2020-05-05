import { wp } from '~helpers/utils'

export const offsetTop = 50
export const rows = 24
export const rowHeight = 30
export const rowGap = 10
export const scrollViewHeight = offsetTop + rows * (rowHeight + rowGap)
export const rowToPx = (row: number) => offsetTop + row * (rowHeight + rowGap)
export const offset = wp(40)

export const mapRange = (
  current: number,
  [fromMin, fromMax]: [number, number],
  [toMin, toMax]: [number, number]
) => toMin + ((toMax - toMin) * (current - fromMin)) / (fromMax - fromMin)
