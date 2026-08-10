import type { ResourceLanguage } from '~helpers/databaseTypes'
import { getDefaultBibleVersion } from '~helpers/languageUtils'
import type { OnboardingResourceSelection } from './onboardingResources'

export const OFFLINE_SETUP_PRESET_IDS = [
  'read-bible',
  'understand-words',
  'explore-bible',
  'original-languages',
] as const

export type OfflineSetupPresetId = (typeof OFFLINE_SETUP_PRESET_IDS)[number]

export const getOfflineSetupPresetSelections = (
  presetId: OfflineSetupPresetId,
  lang: ResourceLanguage
): OnboardingResourceSelection[] => {
  const defaultVersion = getDefaultBibleVersion(lang)

  switch (presetId) {
    case 'read-bible':
      return [{ kind: 'bible', versionId: defaultVersion }]
    case 'understand-words':
      return [
        { kind: 'bible', versionId: defaultVersion },
        { kind: 'bible-strong', versionId: defaultVersion },
        { kind: 'strong-lexicon', moduleId: 'core' },
        { kind: 'database', databaseId: 'DICTIONNAIRE', lang },
      ]
    case 'explore-bible':
      return [
        { kind: 'database', databaseId: 'NAVE', lang },
        { kind: 'database', databaseId: 'TRESOR', lang },
        ...(lang === 'fr' ? ([{ kind: 'database', databaseId: 'MHY', lang }] as const) : []),
        { kind: 'database', databaseId: 'TIMELINE', lang },
        { kind: 'strong-lexicon', moduleId: 'core' },
        { kind: 'strong-lexicon', moduleId: 'entities' },
      ]
    case 'original-languages':
      return [
        { kind: 'bible', versionId: 'BHG' },
        { kind: 'bible-interlinear', lang },
        { kind: 'strong-lexicon', moduleId: 'core' },
        { kind: 'strong-lexicon', moduleId: 'resources' },
      ]
  }
}

export const resolveOfflineSetupSelections = (
  presetIds: Iterable<OfflineSetupPresetId>,
  lang: ResourceLanguage
): OnboardingResourceSelection[] => {
  const selections = Array.from(presetIds).flatMap(id => getOfflineSetupPresetSelections(id, lang))

  return [
    ...new Map(
      selections.map(selection => [
        selection.kind === 'database'
          ? `${selection.kind}:${selection.databaseId}:${selection.lang}`
          : selection.kind === 'bible' || selection.kind === 'bible-strong'
            ? `${selection.kind}:${selection.versionId}`
            : selection.kind === 'bible-interlinear'
              ? `${selection.kind}:${selection.lang}`
              : `${selection.kind}:${selection.moduleId ?? 'core'}`,
        selection,
      ])
    ).values(),
  ]
}
