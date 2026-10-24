/** The two languages Bible Strong publishes its study resources in. */
export type StudyLanguage = 'fr' | 'en'

export const STUDY_LANGUAGES = ['fr', 'en'] as const

/**
 * The language a tool answers in when it is not asked for one: the one of the host, as far
 * as it is French or English. French is the first language of the product, English the one
 * of everyone else.
 */
export const studyLanguageOf = (locale: unknown): StudyLanguage =>
  typeof locale === 'string' && locale.toLowerCase().startsWith('fr') ? 'fr' : 'en'
