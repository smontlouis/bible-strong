import atomWithAsyncStorage from '~helpers/atomWithAsyncStorage'
import type { StrongLexiconModuleId } from '~helpers/strongLexiconPublications'

export type DismissibleStrongLexiconModuleId = Exclude<StrongLexiconModuleId, 'core'>

export type StrongLexiconModulePromptPreferences = Partial<
  Record<DismissibleStrongLexiconModuleId, boolean>
>

export const dismissStrongLexiconModulePrompt = (
  preferences: StrongLexiconModulePromptPreferences,
  moduleId: DismissibleStrongLexiconModuleId
): StrongLexiconModulePromptPreferences => {
  if (preferences[moduleId]) return preferences
  return { ...preferences, [moduleId]: true }
}

export const strongLexiconModulePromptPreferencesAtom =
  atomWithAsyncStorage<StrongLexiconModulePromptPreferences>(
    'strongLexiconModulePromptPreferences',
    {}
  )
