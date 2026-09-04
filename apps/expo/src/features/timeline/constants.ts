import { wp } from '~helpers/utils'
import i18n from '~i18n'

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
    return i18n.t('Après le millenium')
  }

  if (start >= 2010 && end >= 2010) {
    return i18n.t('Futur')
  }

  if (end === 2020) {
    return `${absStart}${i18n.t('-Futur')}`
  }

  if (end === 1844) {
    return i18n.t('457 av.JC. à 1844')
  }

  if (start === end) {
    return `${absStart}${start < 0 ? i18n.t(' av.JC') : ''}`
  }

  if (start < 0 && end < 0) {
    return `${absStart}-${absEnd} ${i18n.t('av.JC')}${range > 50 ? ` (${range})` : ''}`
  }

  if (start > 0 && end > 0) {
    return `${absStart}-${absEnd}${range > 50 ? ` (${range})` : ''}`
  }

  if (start < 0 && end > 0) {
    return `${absStart} ${i18n.t('av.JC')} ${i18n.t('à')} ${end}${range > 50 ? ` (${range})` : ''}`
  }

  return start
}
