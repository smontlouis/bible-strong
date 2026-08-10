import { versions } from '~helpers/bibleVersions'
import { databases } from '~helpers/databases'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import { getDefaultBibleVersion } from '~helpers/languageUtils'
import {
  ENGLISH_STRONG_BIBLE_PRIORITY,
  FRENCH_STRONG_BIBLE_PRIORITY,
} from '~helpers/strongBiblePublications'
import type { OnboardingResourceSelection } from './onboardingResources'
import { getOnboardingResourceSelectionId } from './onboardingResourceSelectionId'

export const OFFLINE_SETUP_FOLDER_IDS = [
  'read-bible',
  'understand-words',
  'explore-bible',
  'original-languages',
] as const

export type OfflineSetupFolderId = (typeof OFFLINE_SETUP_FOLDER_IDS)[number]

export type OfflineSetupOption = {
  id: string
  label: string
  labelKey?: string
  description?: string
  descriptionKey?: string
  language?: string
  required?: boolean
  requires?: string[]
  selections: OnboardingResourceSelection[]
}

export type OfflineSetupSection = {
  id: string
  titleKey: string
  options: OfflineSetupOption[]
}

export type OfflineSetupFolderOptionIds = Record<OfflineSetupFolderId, string[]>

const getBibleLabel = (versionId: string, lang: ResourceLanguage): string => {
  const version = versions[versionId]
  return lang === 'en' ? (version.name_en ?? version.name) : version.name
}

const createBibleOption = (
  versionId: string,
  lang: ResourceLanguage,
  required = false
): OfflineSetupOption => ({
  id: `bible:${versionId}`,
  label: getBibleLabel(versionId, lang),
  description: versions[versionId].c,
  language: versions[versionId].language,
  required,
  selections: [{ kind: 'bible', versionId }],
})

const createStrongBibleOption = (
  versionId:
    | (typeof FRENCH_STRONG_BIBLE_PRIORITY)[number]
    | (typeof ENGLISH_STRONG_BIBLE_PRIORITY)[number],
  lang: ResourceLanguage
): OfflineSetupOption => ({
  id: `bible-strong:${versionId}`,
  label: getBibleLabel(versionId, lang),
  labelKey: 'offlineSetup.option.strongBible',
  language: versions[versionId].language,
  requires: ['strong-lexicon:core'],
  selections: [
    { kind: 'bible', versionId },
    { kind: 'bible-strong', versionId },
    { kind: 'strong-lexicon', moduleId: 'core' },
  ],
})

const createDatabaseOption = (
  databaseId: 'DICTIONNAIRE' | 'NAVE' | 'TRESOR' | 'MHY' | 'TIMELINE',
  resourceLang: ResourceLanguage,
  currentLang: ResourceLanguage
): OfflineSetupOption => {
  const database = databases(resourceLang)[databaseId]
  return {
    id: `database:${databaseId}:${resourceLang}`,
    label: database.name,
    description: database.desc,
    language: resourceLang,
    labelKey: resourceLang === currentLang ? undefined : 'offlineSetup.option.localizedResource',
    selections: [{ kind: 'database', databaseId, lang: resourceLang }],
  }
}

const getReadableBibleSections = (lang: ResourceLanguage): OfflineSetupSection[] => {
  const requiredVersionId = getDefaultBibleVersion(lang)
  const toOption = (versionId: string) =>
    createBibleOption(versionId, lang, versionId === requiredVersionId)
  const groupedOptions = Object.values(versions).reduce(
    (groups, version) => {
      if (version.hidden || (version.language !== 'fr' && version.language !== 'en')) return groups
      const target = version.language === lang ? groups.primary : groups.other
      target.push(toOption(version.id))
      return groups
    },
    { primary: [] as OfflineSetupOption[], other: [] as OfflineSetupOption[] }
  )

  return [
    {
      id: 'primary-language',
      titleKey: 'offlineSetup.section.primaryLanguage',
      options: groupedOptions.primary,
    },
    {
      id: 'other-languages',
      titleKey: 'offlineSetup.section.otherLanguages',
      options: groupedOptions.other,
    },
  ]
}

const getStrongSections = (lang: ResourceLanguage): OfflineSetupSection[] => {
  const primaryIds = lang === 'fr' ? FRENCH_STRONG_BIBLE_PRIORITY : ENGLISH_STRONG_BIBLE_PRIORITY
  const otherIds = lang === 'fr' ? ENGLISH_STRONG_BIBLE_PRIORITY : FRENCH_STRONG_BIBLE_PRIORITY

  return [
    {
      id: 'strong-tools',
      titleKey: 'offlineSetup.section.sharedTools',
      options: [
        {
          id: 'strong-lexicon:core',
          label: '',
          labelKey: 'offlineSetup.resources.strongLexicon',
          descriptionKey: 'offlineSetup.option.strongLexiconDescription',
          selections: [{ kind: 'strong-lexicon', moduleId: 'core' }],
        },
      ],
    },
    {
      id: 'primary-language',
      titleKey: 'offlineSetup.section.strongBiblesPrimary',
      options: primaryIds.map(versionId => createStrongBibleOption(versionId, lang)),
    },
    {
      id: 'other-languages',
      titleKey: 'offlineSetup.section.strongBiblesOther',
      options: otherIds.map(versionId => createStrongBibleOption(versionId, lang)),
    },
  ]
}

const getExploreSections = (lang: ResourceLanguage): OfflineSetupSection[] => {
  const otherLang: ResourceLanguage = lang === 'fr' ? 'en' : 'fr'
  const primaryDatabaseIds = [
    'DICTIONNAIRE',
    'NAVE',
    ...(lang === 'fr' ? (['MHY'] as const) : []),
    'TIMELINE',
  ] as const

  return [
    {
      id: 'primary-language',
      titleKey: 'offlineSetup.section.primaryLanguage',
      options: primaryDatabaseIds.map(databaseId => createDatabaseOption(databaseId, lang, lang)),
    },
    {
      id: 'shared',
      titleKey: 'offlineSetup.section.sharedResources',
      options: [
        // Cross references use one shared physical copy with a canonical identity.
        createDatabaseOption('TRESOR', 'fr', 'fr'),
        {
          id: 'strong-lexicon:entities',
          label: '',
          labelKey: 'offlineSetup.resources.entities',
          descriptionKey: 'offlineSetup.option.entitiesDescription',
          selections: [
            { kind: 'strong-lexicon', moduleId: 'core' },
            { kind: 'strong-lexicon', moduleId: 'entities' },
          ],
        },
      ],
    },
    {
      id: 'other-languages',
      titleKey: 'offlineSetup.section.otherLanguages',
      options: [
        ...(['DICTIONNAIRE', 'NAVE'] as const),
        ...(otherLang === 'fr' ? (['MHY'] as const) : []),
        'TIMELINE' as const,
      ].map(databaseId => createDatabaseOption(databaseId, otherLang, lang)),
    },
  ]
}

const getOriginalLanguageSections = (lang: ResourceLanguage): OfflineSetupSection[] => [
  {
    id: 'original-text',
    titleKey: 'offlineSetup.section.originalText',
    options: [
      {
        id: 'bible:BHG',
        label: getBibleLabel('BHG', lang),
        description: versions.BHG.c,
        selections: [{ kind: 'bible', versionId: 'BHG' }],
      },
    ],
  },
  {
    id: 'interlinear',
    titleKey: 'offlineSetup.section.interlinearLanguages',
    options: (['fr', 'en'] as const).map(resourceLang => ({
      id: `bible-interlinear:${resourceLang}`,
      label: '',
      labelKey: `offlineSetup.option.interlinear.${resourceLang}`,
      language: resourceLang,
      requires: ['bible:BHG'],
      selections: [
        { kind: 'bible', versionId: 'BHG' },
        { kind: 'bible-interlinear', lang: resourceLang },
      ],
    })),
  },
  {
    id: 'language-tools',
    titleKey: 'offlineSetup.section.sharedTools',
    options: [
      {
        id: 'strong-lexicon:core',
        label: '',
        labelKey: 'offlineSetup.resources.strongLexicon',
        descriptionKey: 'offlineSetup.option.strongLexiconDescription',
        selections: [{ kind: 'strong-lexicon', moduleId: 'core' }],
      },
      {
        id: 'strong-lexicon:resources',
        label: '',
        labelKey: 'offlineSetup.resources.greekDictionary',
        descriptionKey: 'offlineSetup.option.greekDictionaryDescription',
        requires: ['strong-lexicon:core'],
        selections: [
          { kind: 'strong-lexicon', moduleId: 'core' },
          { kind: 'strong-lexicon', moduleId: 'resources' },
        ],
      },
    ],
  },
]

export const getOfflineSetupFolderSections = (
  folderId: OfflineSetupFolderId,
  lang: ResourceLanguage
): OfflineSetupSection[] => {
  switch (folderId) {
    case 'read-bible':
      return getReadableBibleSections(lang)
    case 'understand-words':
      return getStrongSections(lang)
    case 'explore-bible':
      return getExploreSections(lang)
    case 'original-languages':
      return getOriginalLanguageSections(lang)
  }
}

export const getDefaultOfflineSetupFolderOptionIds = (
  lang: ResourceLanguage
): OfflineSetupFolderOptionIds => ({
  'read-bible': [`bible:${getDefaultBibleVersion(lang)}`],
  'understand-words': [],
  'explore-bible': [],
  'original-languages': [],
})

export const toggleOfflineSetupOptionId = (
  selectedIds: readonly string[],
  option: Pick<OfflineSetupOption, 'id' | 'required' | 'requires'>,
  folderOptions: readonly Pick<OfflineSetupOption, 'id' | 'requires'>[] = []
): string[] => {
  if (option.required) return [...selectedIds]
  const selectedIdSet = new Set(selectedIds)
  if (selectedIdSet.has(option.id)) {
    return isOfflineSetupOptionLocked(option, selectedIds, folderOptions)
      ? [...selectedIds]
      : selectedIds.filter(id => id !== option.id)
  }

  return [...new Set([...selectedIds, option.id, ...(option.requires ?? [])])]
}

export const isOfflineSetupOptionLocked = (
  option: Pick<OfflineSetupOption, 'id' | 'required'>,
  selectedIds: readonly string[],
  folderOptions: readonly Pick<OfflineSetupOption, 'id' | 'requires'>[] = []
): boolean => {
  if (option.required) return true
  const selectedIdSet = new Set(selectedIds)
  return folderOptions.some(
    candidate =>
      candidate.id !== option.id &&
      selectedIdSet.has(candidate.id) &&
      candidate.requires?.includes(option.id)
  )
}

export const resolveOfflineSetupFolderOptionIds = (
  optionIdsByFolder: OfflineSetupFolderOptionIds,
  lang: ResourceLanguage
): OnboardingResourceSelection[] => {
  const requiredBible: OnboardingResourceSelection = {
    kind: 'bible',
    versionId: getDefaultBibleVersion(lang),
  }
  const selections = OFFLINE_SETUP_FOLDER_IDS.flatMap(folderId => {
    const selectedIds = new Set(optionIdsByFolder[folderId])
    return getOfflineSetupFolderSections(folderId, lang).flatMap(section =>
      section.options.flatMap(option => (selectedIds.has(option.id) ? option.selections : []))
    )
  })

  return [
    ...new Map(
      [requiredBible, ...selections].map(selection => [
        getOnboardingResourceSelectionId(selection),
        selection,
      ])
    ).values(),
  ]
}
