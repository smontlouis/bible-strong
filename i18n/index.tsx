import i18n from 'i18next'
import * as RNLocalize from 'react-native-localize'
import { initReactI18next } from 'react-i18next'
import 'react-native-url-polyfill/auto'

import type { ActiveLanguage } from '~helpers/languageUtils'
import { DEFAULT_LANGUAGE, isActiveLanguage } from '~helpers/languageUtils'
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

const fallback = { languageTag: 'fr', isRTL: false }
const { languageTag } = RNLocalize.findBestAvailableLanguage(['en', 'fr']) || fallback

const languageDetector = {
  type: 'languageDetector' as const,
  async: false,
  init: () => {},
  detect: () => storage.getString('lang') || languageTag,
  cacheUserLanguage: (language: string) => {
    storage.set('lang', language)
  },
}

export const setI18n = async () =>
  await i18n
    .use(initReactI18next)
    // @ts-ignore
    .use(languageDetector)
    .init({
      resources,
      fallbackLng: 'fr',
      keySeparator: false,
      interpolation: {
        escapeValue: false,
      },
      cleanCode: true,
    })

/**
 * Get the current language code
 * Returns the i18n language if set, otherwise falls back to device language tag
 */
export const getLanguage = (): ActiveLanguage => {
  const lang = i18n.language || languageTag
  return isActiveLanguage(lang) ? lang : DEFAULT_LANGUAGE
}

/**
 * @deprecated Use getLanguage() instead
 * This function returns a boolean which doesn't scale for multiple languages
 */
export const getLangIsFr = () => getLanguage() === 'fr'

export default i18n
