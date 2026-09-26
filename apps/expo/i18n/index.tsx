import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import 'react-native-url-polyfill/auto'

import type { ActiveLanguage } from '~helpers/languageUtils'
import { DEFAULT_LANGUAGE, isActiveLanguage } from '~helpers/languageUtils'
import { isPlaygroundEnabled } from '~helpers/runtimeConfig'
import { storage } from '~helpers/storage'

const enTranslation = require('./locales/en/translation.json')
const enBooksTranslation = require('./locales/en/translation_book.json')
const frTranslation = require('./locales/fr/translation.json')
const frBooksTranslation = require('./locales/fr/translation_book.json')

const resources = {
  en: {
    translation: { ...enTranslation, ...enBooksTranslation },
  },
  fr: {
    translation: { ...frTranslation, ...frBooksTranslation },
  },
}

const getDeviceLanguage = (): ActiveLanguage => {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale
  const language = locale.split('-')[0]

  return isActiveLanguage(language) ? language : DEFAULT_LANGUAGE
}

const languageTag = getDeviceLanguage()

const languageDetector = {
  type: 'languageDetector' as const,
  async: false,
  init: () => {},
  detect: () => {
    try {
      const cachedLanguage = storage.getString('lang')
      return cachedLanguage && isActiveLanguage(cachedLanguage) ? cachedLanguage : languageTag
    } catch (error) {
      console.warn('[i18n] Failed to read cached language from MMKV:', error)
      return languageTag
    }
  },
  cacheUserLanguage: (language: string) => {
    if (isPlaygroundEnabled) return

    try {
      storage.set('lang', language)
    } catch (error) {
      console.warn('[i18n] Failed to cache language in MMKV:', error)
    }
  },
}

// Init at module level so the promise is already resolved when useAppLoad awaits it.
// Resources are already in memory (require'd above) and languageDetector is synchronous.
const initPromise = i18n
  .use(initReactI18next)
  // @ts-ignore
  .use(languageDetector)
  .init({
    resources,
    fallbackLng: DEFAULT_LANGUAGE,
    returnEmptyString: false,
    keySeparator: false,
    interpolation: {
      escapeValue: false,
    },
    cleanCode: true,
  })

export const setI18n = () => initPromise

/**
 * Get the current language code
 * Returns the i18n language if set, otherwise falls back to device language tag
 */
export const getLanguage = (): ActiveLanguage => {
  const lang = i18n.language || languageTag
  return isActiveLanguage(lang) ? lang : DEFAULT_LANGUAGE
}

export default i18n
