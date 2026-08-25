import type { ResourceLanguage } from './databaseTypes'
import {
  createInterlinearSidecarDownloadPlan,
  createStrongSidecarDownloadPlan,
  dedupeDownloadItems,
} from './downloadItemFactory'
import type { InterlinearSidecarAvailability } from './interlinearBibleSidecar'
import type { StrongBibleSidecarAvailability } from './strongBibleSidecar'
import type { StrongBibleVersionId, StrongMode } from './strongBiblePublications'
import type { DownloadItem } from '~state/downloadQueue'

export type InterlinearAvailabilityCandidate = {
  locale: ResourceLanguage
  availability: InterlinearSidecarAvailability
}

type StrongModeDownloadPlanArgs = {
  mode: Exclude<StrongMode, 'hidden'>
  versionId: StrongBibleVersionId
  strongAvailability: StrongBibleSidecarAvailability
  interlinearAvailabilities: InterlinearAvailabilityCandidate[]
}

export type StrongModeDownloadPlan = {
  items: DownloadItem[]
  preferredInterlinearLocale?: ResourceLanguage
}

export const createStrongModeDownloadPlan = ({
  mode,
  versionId,
  strongAvailability,
  interlinearAvailabilities,
}: StrongModeDownloadPlanArgs): StrongModeDownloadPlan => {
  const strongItems =
    strongAvailability.status === 'available'
      ? []
      : createStrongSidecarDownloadPlan(versionId, strongAvailability.status)

  if (mode === 'visible') {
    return { items: strongItems }
  }

  const installedInterlinear = interlinearAvailabilities.find(
    ({ availability }) => availability.status === 'available'
  )
  const preferredInterlinear = installedInterlinear ?? interlinearAvailabilities[0]
  const interlinearItems =
    installedInterlinear || !preferredInterlinear
      ? []
      : createInterlinearSidecarDownloadPlan(
          preferredInterlinear.locale,
          preferredInterlinear.availability.status
        )

  return {
    items: dedupeDownloadItems([...strongItems, ...interlinearItems]),
    preferredInterlinearLocale: preferredInterlinear?.locale,
  }
}

export const getDownloadPlanEstimatedSize = (items: DownloadItem[]): number =>
  items.reduce((total, item) => total + item.estimatedSize, 0)
