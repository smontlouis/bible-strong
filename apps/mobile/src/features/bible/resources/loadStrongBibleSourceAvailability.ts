import {
  type BhgLexiconAvailability,
  type LexiconBibleResourceAccess,
} from '~features/resources/lexiconBibleResourceAccess'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import type { StrongBibleResourceAccess } from '~features/resources/strongBibleResourceAccess'
import type { StrongBibleSidecarAvailability } from '~helpers/strongBibleSidecar'
import type { StrongBibleVersionId } from '~helpers/strongBiblePublications'

export type StrongBibleSourceAvailabilityState = {
  availabilityByVersion: Map<StrongBibleVersionId, StrongBibleSidecarAvailability>
  bhgAvailability?: BhgLexiconAvailability
}

export const loadStrongBibleSourceAvailability = async ({
  versionIds,
  includeBhg,
  preferredInterlinearLocale,
  getStrongAvailability,
  getInterlinearAvailability,
}: {
  versionIds: readonly StrongBibleVersionId[]
  includeBhg: boolean
  preferredInterlinearLocale: ResourceLanguage
  getStrongAvailability: StrongBibleResourceAccess['getAvailability']
  getInterlinearAvailability: LexiconBibleResourceAccess['getInterlinearAvailability']
}): Promise<StrongBibleSourceAvailabilityState> => {
  const [strongAvailabilities, bhgAvailability] = await Promise.all([
    Promise.all(
      versionIds.map(
        async versionId => [versionId, await getStrongAvailability(versionId)] as const
      )
    ),
    includeBhg
      ? getInterlinearAvailability(preferredInterlinearLocale).then(
          (availability): BhgLexiconAvailability =>
            availability.status === 'available'
              ? { status: 'available', locale: preferredInterlinearLocale }
              : {
                  status: 'unavailable',
                  attempts: [{ locale: preferredInterlinearLocale, status: availability.status }],
                }
        )
      : Promise.resolve(undefined),
  ])

  return {
    availabilityByVersion: new Map(strongAvailabilities),
    bhgAvailability,
  }
}
