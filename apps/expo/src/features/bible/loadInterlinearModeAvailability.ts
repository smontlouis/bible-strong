import type { ResourceLanguage } from '~helpers/databaseTypes'
import type { InterlinearSidecarAvailability } from '~helpers/interlinearBibleSidecar'
import type { LexiconBibleResourceAccess } from '~features/resources/lexiconBibleResourceAccess'

export type InterlinearModeAvailabilityState = Record<
  ResourceLanguage,
  InterlinearSidecarAvailability
>

export const loadInterlinearModeAvailability = async (
  getAvailability: LexiconBibleResourceAccess['getInterlinearAvailability']
): Promise<InterlinearModeAvailabilityState> => {
  const [fr, en] = await Promise.all([getAvailability('fr'), getAvailability('en')])
  return { fr, en }
}
