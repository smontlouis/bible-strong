import { useTranslation } from 'react-i18next'
import type { ActiveLanguage } from '~helpers/languageUtils'
import { DEFAULT_LANGUAGE, isActiveLanguage, getDateLocale } from '~helpers/languageUtils'

/**
 * React hook to get the current language code
 * Returns the language code (e.g., 'fr', 'en') instead of a boolean
 *
 * @example
 * const lang = useLanguage()
 * // lang is 'fr' or 'en'
 *
 * // For date formatting:
 * const locale = getDateLocale(lang)
 * format(date, 'PP', { locale })
 *
 * // For localized content (scalable for multiple languages):
 * import { getLegacyLocalizedField } from '~helpers/languageUtils'
 * const title = getLegacyLocalizedField(lang, { fr: titleFr, en: titleEn })
 */
const useLanguage = (): ActiveLanguage => {
  const { i18n } = useTranslation()
  const lang = i18n.language
  return isActiveLanguage(lang) ? lang : DEFAULT_LANGUAGE
}

export default useLanguage

/**
 * React hook to get the date-fns locale for the current language
 * Convenient wrapper that combines useLanguage() and getDateLocale()
 *
 * @example
 * const dateLocale = useDateLocale()
 * format(date, 'PP', { locale: dateLocale })
 */
export const useDateLocale = () => {
  const lang = useLanguage()
  return getDateLocale(lang)
}
