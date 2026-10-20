import type { ResourceLanguage } from '~helpers/databaseTypes'
import { getInterlinearLocalePriority } from '~helpers/interlinearDisplayMode'
import type { InterlinearSidecarAvailability } from '~helpers/interlinearBibleSidecar'
import type { StrongBibleSidecarAvailability } from '~helpers/strongBibleSidecar'
import { isStrongCapableBibleVersion } from '~helpers/strongBiblePublications'
import type { LexiconBibleResourceAccess } from '~features/resources/lexiconBibleResourceAccess'
import type { StrongBibleResourceAccess } from '~features/resources/strongBibleResourceAccess'

type InterlinearAvailabilityCandidate = {
  locale: ResourceLanguage
  availability: InterlinearSidecarAvailability
}

export type StrongModeAvailabilityState = {
  strong?: StrongBibleSidecarAvailability
  interlinear: InterlinearAvailabilityCandidate[]
}

export const loadStrongModeAvailability = async ({
  appLanguage,
  getInterlinearAvailability,
  getStrongAvailability,
  version,
}: {
  appLanguage: ResourceLanguage
  getInterlinearAvailability: LexiconBibleResourceAccess['getInterlinearAvailability']
  getStrongAvailability: StrongBibleResourceAccess['getAvailability']
  version: string
}): Promise<StrongModeAvailabilityState> => {
  if (!isStrongCapableBibleVersion(version)) return { interlinear: [] }
  const [strong, interlinear] = await Promise.all([
    getStrongAvailability(version),
    Promise.all(
      getInterlinearLocalePriority(appLanguage).map(locale =>
        getInterlinearAvailability(locale).then(availability => ({ locale, availability }))
      )
    ),
  ])
  return { strong, interlinear }
}
