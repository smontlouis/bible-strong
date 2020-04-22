import { wp } from '~helpers/utils'

const periods = [
  [-4100, -2900, 100, 'First Generation', 'Age of Patriarchs'],
  [-2900, -1950, 25, 'Noah & The Flood', 'Age of Patriarchs'],
  [-1950, -1650, 10, 'The Patriarchs', 'Age of Patriarchs'],
  [-1650, -1450, 25, 'Israel in Egypt', 'Age of Israel'],
  [-1450, -1100, 25, 'The Judges', 'Age of Israel'],
  [-1100, -930, 5, 'United Kingdom', 'Age of Israel'],
  [-930, -620, 5, 'Divided Kingdom', 'Age of Israel'],
  [-620, -100, 10, 'The Exile', 'Age of Israel'],
  [-100, 35, 1, 'Life of Christ', 'Age of Christ'],
  [35, 350, 5, 'Early Church', 'Age of Christ'],
  [350, 1520, 25, 'Middle Ages', 'Age of Christ'],
  [1520, 1840, 5, 'Reformation', 'Age of Christ'],
  [1840, 3100, 25, 'Revelation Prophecies', 'Age of Christ'],
]

export const rows = 24
export const rowHeight = 30
export const rowGap = 10
export const scrollViewHeight = rows * (rowHeight + rowGap)

export const offset = wp(40)
export const ratio = 1
export const scrollViewWidth = 7200 * ratio
export const yearRange: [number, number] = [-4100, 3100]
export const timelineWidth: [number, number] = [0, scrollViewWidth]

export const yearsToPx = (years: number) =>
  Math.round(mapRange(years, yearRange, timelineWidth))

export const pxToYears = (pixels: number) =>
  Math.round(mapRange(pixels, timelineWidth, yearRange))

export const rowToPx = (row: number) => row * (rowHeight + rowGap)

export const mapRange = (
  current: number,
  [fromMin, fromMax]: [number, number],
  [toMin, toMax]: [number, number]
) => toMin + ((toMax - toMin) * (current - fromMin)) / (fromMax - fromMin)

export const calculateEventWidth = (yearStart: number, yearEnd: number) => {
  const year = Math.abs(yearStart - yearEnd)
  return yearsToPx(yearRange[0] + year) < 200
    ? 200
    : yearsToPx(yearRange[0] + year)
}
