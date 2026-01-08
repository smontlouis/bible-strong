import i18n from 'i18next'
import * as RNLocalize from 'react-native-localize'
import { initReactI18next } from 'react-i18next'
import AsyncStorage from '@react-native-async-storage/async-storage'
import 'react-native-url-polyfill/auto'
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
  type: 'languageDetector',
  async: true,
  init: () => {},
  detect: async (callback: any) => {
    try {
      AsyncStorage.getItem('lang').then(language => {
        if (language) {
          return callback(language)
        }

        return callback(languageTag)
      })
    } catch (error) {
      callback(languageTag)
    }
  },
  cacheUserLanguage: (language: 'string') => {
    try {
      AsyncStorage.setItem('lang', language)
    } catch (error) {}
  },
}

export const setI18n = async () =>
  await i18n
    .use(initReactI18next)
    // @ts-ignore
    .use(languageDetector)
    .init({
      // debug: __DEV__,
      resources,
      fallbackLng: 'fr',
      keySeparator: false,
      interpolation: {
        escapeValue: false,
      },
      cleanCode: true,
    })

import type { ActiveLanguage } from '~helpers/languageUtils'
import { DEFAULT_LANGUAGE, isActiveLanguage } from '~helpers/languageUtils'

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
