import type { ResourceLanguage } from './databaseTypes'

export type InterlinearDisplayMode = 'interlinear' | 'strong' | 'transliteration'
export type InterlinearMode = 'hidden' | 'visible' | InterlinearDisplayMode

export const normalizeInterlinearMode = (
  mode?: InterlinearMode
): 'hidden' | InterlinearDisplayMode => {
  if (!mode || mode === 'hidden') return 'hidden'
  return mode === 'visible' ? 'interlinear' : mode
}

export const isInterlinearModeEnabled = (mode?: InterlinearMode): boolean =>
  normalizeInterlinearMode(mode) !== 'hidden'

export const shouldSuppressVerseGestures = (version: string, mode?: InterlinearMode): boolean =>
  version === 'BHG' && isInterlinearModeEnabled(mode)

export const getInterlinearLocalePriority = (
  preferredLocale: ResourceLanguage
): readonly [ResourceLanguage, ResourceLanguage] =>
  preferredLocale === 'en' ? ['en', 'fr'] : ['fr', 'en']
