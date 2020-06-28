import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
const enTranslation = require('./locales/en/translation.json')
const enBooksTranslation = require('./locales/en/translation_book.json')
const frTranslation = require('./locales/fr/translation.json')

const resources = {
  en: {
    translation: { ...enTranslation, ...enBooksTranslation },
  },
  fr: {
    translation: frTranslation,
  },
}

i18n.use(initReactI18next).init({
  debug: __DEV__,
  resources,
  lng: 'en',
  fallbackLng: 'fr',
  keySeparator: false,
  interpolation: {
    escapeValue: false,
  },
  cleanCode: true,
})

export default i18n
