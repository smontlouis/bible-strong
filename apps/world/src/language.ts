export type Language = 'en' | 'fr'
export const LANGUAGE_KEY = 'bible-strong.world.language.v1'

export function loadLanguage(): Language {
  try {
    const saved = localStorage.getItem(LANGUAGE_KEY)
    if (saved === 'en' || saved === 'fr') return saved
  } catch {
    // Browser preferences still work when storage is blocked.
  }
  if (typeof navigator !== 'undefined') {
    const preferences = navigator.languages?.length ? navigator.languages : [navigator.language]
    for (const preference of preferences) {
      const language = preference?.toLowerCase().split(/[-_]/)[0]
      if (language === 'en' || language === 'fr') return language
    }
  }
  return 'en'
}

export function saveLanguage(language: Language): void {
  try {
    localStorage.setItem(LANGUAGE_KEY, language)
  } catch {
    // Keep the selected language in React state when storage is unavailable.
  }
}
