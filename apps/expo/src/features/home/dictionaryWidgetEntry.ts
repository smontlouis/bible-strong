const DICTIONARY_ENTRY_ID_RANGES = {
  fr: { min: 5437, max: 10872 },
  en: { min: 1, max: 8620 },
} as const

export const getRandomDictionaryEntryId = (language: 'fr' | 'en', random = Math.random()) => {
  const { min, max } = DICTIONARY_ENTRY_ID_RANGES[language]
  return Math.floor(random * (max - min + 1) + min)
}
