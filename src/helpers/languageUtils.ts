/**
 * Language utilities for multi-language support
 *
 * This module provides centralized language handling to support more than two languages.
 * Instead of boolean checks like `isFR`, use language codes and helper functions.
 */

import { fr, enGB, enUS, es, de, pt, it, nl, Locale } from 'date-fns/locale'

// Common Bible version codes used as defaults
// Full VersionCode type is defined in src/state/tabs.ts
type DefaultVersionCode = 'LSG' | 'KJV'

// Supported languages in the app
// Add new languages here when expanding language support
export const SUPPORTED_LANGUAGES = ['fr', 'en', 'es', 'de', 'pt', 'it', 'nl'] as const
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

// Currently active languages (languages with full translation support)
// Languages here have translation files in i18n/locales/
export const ACTIVE_LANGUAGES = ['fr', 'en'] as const
export type ActiveLanguage = (typeof ACTIVE_LANGUAGES)[number]

// Type guard to check if a language is supported
export const isSupportedLanguage = (lang: string): lang is SupportedLanguage =>
  SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage)

// Type guard to check if a language is active (has full translations)
export const isActiveLanguage = (lang: string): lang is ActiveLanguage =>
  ACTIVE_LANGUAGES.includes(lang as ActiveLanguage)

// Default language for the app
export const DEFAULT_LANGUAGE: ActiveLanguage = 'fr'

/**
 * Default Bible versions per language
 * Maps language codes to their default Bible version
 */
export const DEFAULT_BIBLE_VERSIONS: Record<ActiveLanguage, DefaultVersionCode> = {
  fr: 'LSG',
  en: 'KJV',
}

/**
 * Get the default Bible version for a language
 * Falls back to LSG if language is not found
 */
export const getDefaultBibleVersion = (lang: string): DefaultVersionCode => {
  if (isActiveLanguage(lang)) {
    return DEFAULT_BIBLE_VERSIONS[lang]
  }
  return DEFAULT_BIBLE_VERSIONS[DEFAULT_LANGUAGE]
}

/**
 * Date-fns locales mapping
 * Maps language codes to date-fns Locale objects
 */
export const DATE_LOCALES: Record<SupportedLanguage, Locale> = {
  fr,
  en: enGB,
  es,
  de,
  pt,
  it,
  nl,
}

// Alternative English locale (US format)
export const DATE_LOCALE_EN_US = enUS

/**
 * Get the date-fns locale for a language
 * Falls back to French if language is not found
 */
export const getDateLocale = (lang: string): Locale => {
  if (isSupportedLanguage(lang)) {
    return DATE_LOCALES[lang]
  }
  return DATE_LOCALES[DEFAULT_LANGUAGE]
}

/**
 * Type for localized content object
 * Each key is a language code, value is the content in that language
 */
export type LocalizedContent<T> = Partial<Record<SupportedLanguage, T>> & {
  // Default fallback (usually French or English)
  default?: T
}

/**
 * Get localized content based on language
 * Tries the exact language first, then falls back to default language
 *
 * @example
 * const title = getLocalizedContent(lang, {
 *   fr: 'Bonjour',
 *   en: 'Hello',
 *   es: 'Hola',
 * })
 */
export function getLocalizedContent<T>(
  lang: string,
  content: LocalizedContent<T>,
  fallbackLang: SupportedLanguage = DEFAULT_LANGUAGE
): T | undefined {
  // Try exact language match
  if (isSupportedLanguage(lang) && content[lang] !== undefined) {
    return content[lang]
  }

  // Try fallback language
  if (content[fallbackLang] !== undefined) {
    return content[fallbackLang]
  }

  // Try default property
  if (content.default !== undefined) {
    return content.default
  }

  // Return first available content
  const availableLangs = Object.keys(content).filter(
    k => k !== 'default' && content[k as SupportedLanguage] !== undefined
  ) as SupportedLanguage[]

  if (availableLangs.length > 0) {
    return content[availableLangs[0]]
  }

  return undefined
}

/**
 * Helper for legacy data that uses title/titleEn pattern
 * Converts legacy format to LocalizedContent and retrieves the appropriate value
 *
 * NOTE: This is a transition helper. New data should use LocalizedContent format directly:
 * { title: { fr: '...', en: '...', es: '...' } }
 *
 * @example
 * // For legacy data with title/titleEn:
 * const displayTitle = getLegacyLocalizedField(lang, { fr: title, en: titleEn })
 *
 * // When adding a new language, add it to the object:
 * const displayTitle = getLegacyLocalizedField(lang, { fr: title, en: titleEn, es: titleEs })
 */
export function getLegacyLocalizedField<T>(
  lang: string,
  content: Partial<Record<SupportedLanguage, T>>
): T {
  const result = getLocalizedContent(lang, content)
  // Fallback to first available value if undefined
  if (result === undefined) {
    const values = Object.values(content).filter(v => v !== undefined)
    return values[0] as T
  }
  return result
}

/**
 * Language display names in their own language
 */
export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  fr: 'Francais',
  en: 'English',
  es: 'Espanol',
  de: 'Deutsch',
  pt: 'Portugues',
  it: 'Italiano',
  nl: 'Nederlands',
}

/**
 * Language flag emojis for UI display
 */
export const LANGUAGE_FLAGS: Record<SupportedLanguage, string> = {
  fr: '🇫🇷',
  en: '🇬🇧',
  es: '🇪🇸',
  de: '🇩🇪',
  pt: '🇵🇹',
  it: '🇮🇹',
  nl: '🇳🇱',
}

/**
 * Get language display info
 */
export const getLanguageInfo = (lang: string) => {
  if (isSupportedLanguage(lang)) {
    return {
      code: lang,
      name: LANGUAGE_NAMES[lang],
      flag: LANGUAGE_FLAGS[lang],
    }
  }
  return {
    code: lang,
    name: lang.toUpperCase(),
    flag: '🌐',
  }
}
