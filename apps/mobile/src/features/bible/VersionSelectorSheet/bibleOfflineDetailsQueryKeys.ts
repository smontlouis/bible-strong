export const getBibleOfflineDetailsQueryKey = (
  versionId: string,
  installedSignal: number,
  completionSignal: number
) => ['bible-offline-details', 'bible', versionId, installedSignal, completionSignal] as const

export const getStrongOfflineDetailsQueryKey = (
  versionId: string,
  installedSignal: number,
  completionSignal: number
) => ['bible-offline-details', 'strong', versionId, installedSignal, completionSignal] as const

export const getInterlinearOfflineDetailsQueryKey = (
  language: string,
  installedSignal: number,
  completionSignal: number
) =>
  [
    'bible-offline-details',
    'interlinear',
    'BHG',
    language,
    installedSignal,
    completionSignal,
  ] as const
