import i18n from '~i18n'
import type { ResourceLanguage } from '~helpers/databaseTypes'

export const calculateLabel = (start: number, end: number, language: ResourceLanguage) => {
  const t = i18n.getFixedT(language)
  const absStart = Math.abs(start)
  const absEnd = Math.abs(end)
  const range = Math.abs(start - end)

  if (start >= 3000 && end >= 3000) {
    return t('Après le millenium')
  }

  if (start >= 2010 && end >= 2010) {
    return t('Futur')
  }

  if (end === 2020) {
    return `${absStart}${t('-Futur')}`
  }

  if (end === 1844) {
    return t('457 av.JC. à 1844')
  }

  if (start === end) {
    return `${absStart}${start < 0 ? t(' av.JC') : ''}`
  }

  if (start < 0 && end < 0) {
    return `${absStart}-${absEnd} ${t('av.JC')}${range > 50 ? ` (${range})` : ''}`
  }

  if (start > 0 && end > 0) {
    return `${absStart}-${absEnd}${range > 50 ? ` (${range})` : ''}`
  }

  if (start < 0 && end > 0) {
    return `${absStart} ${t('av.JC')} ${t('à')} ${end}${range > 50 ? ` (${range})` : ''}`
  }

  return start
}
