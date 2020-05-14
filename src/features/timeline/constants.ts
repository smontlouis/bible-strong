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

export const calculateLabel = (start: number, end: number) => {
  const absStart = Math.abs(start)
  const absEnd = Math.abs(end)
  const range = Math.abs(start - end)

  if (start >= 3000 && end >= 3000) {
    return 'Après le millenium'
  }

  if (start >= 2010 && end >= 2010) {
    return 'Futur'
  }

  if (end === 2020) {
    return `${absStart}-Futur`
  }

  if (end === 1844) {
    return '457 av. J.-C. à 1844'
  }

  if (start === end) {
    return `${absStart}${start < 0 ? ' av. J.-C.' : ''}`
  }

  if (start < 0 && end < 0) {
    return `${absStart}-${absEnd} av. J.-C.${range > 50 ? ` (${range})` : ''}`
  }

  if (start > 0 && end > 0) {
    return `${absStart}-${absEnd}${range > 50 ? ` (${range})` : ''}`
  }

  if (start < 0 && end > 0) {
    return `${absStart} av. J.-C à ${end}${range > 50 ? ` (${range})` : ''}`
  }

  return start
}
