import { versions } from '~helpers/bibleVersions'
import { databases } from '~helpers/databases'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import { getDefaultBibleVersion } from '~helpers/languageUtils'
import type { StrongBibleVersionId } from '~helpers/strongBiblePublications'
import {
  getVersionCatalogSections,
  type VersionCatalogLabels,
} from '~features/bible/versionCatalog'
import {
  getBibleDefaultCatalog,
  type BibleDefaultSelectionKind,
} from '~features/bible/bibleDefaultCatalog'
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
  titleKey?: string
  collapsedByDefault?: boolean
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
  required = false,
  label = getBibleLabel(versionId, lang)
): OfflineSetupOption => ({
  id: `bible:${versionId}`,
  label,
  description: versions[versionId].c,
  language: versions[versionId].language,
  required,
  selections: [{ kind: 'bible', versionId }],
})

const createStrongBibleOption = (
  versionId: StrongBibleVersionId,
  lang: ResourceLanguage,
  label = getBibleLabel(versionId, lang)
): OfflineSetupOption => ({
  id: `bible-strong:${versionId}`,
  label,
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

const VERSION_CATALOG_LABELS: VersionCatalogLabels = {
  languages: { fr: 'fr', en: 'en', he: 'he', grc: 'grc', 'he-grc': 'he-grc', la: 'la' },
  profiles: {
    'word-for-word': 'versionCatalog.style.wordForWord',
    balanced: 'versionCatalog.style.balanced',
    'thought-for-thought': 'versionCatalog.style.thoughtForThought',
    paraphrase: 'versionCatalog.style.paraphrase',
  },
  other: 'versionCatalog.style.other',
}

const getBibleFolderCatalogSections = (kind: BibleDefaultSelectionKind, lang: ResourceLanguage) => {
  const catalog = getBibleDefaultCatalog(kind)
  const primarySections = getVersionCatalogSections({
    catalog: catalog.filter(version => version.language === lang),
    grouping: 'style',
    query: '',
    uiLanguage: lang,
    labels: VERSION_CATALOG_LABELS,
  }).map(section => ({
    key: `style-${section.key}`,
    titleKey: section.title,
    collapsedByDefault: false,
    data: section.data,
  }))
  const otherLanguagesSection = getVersionCatalogSections({
    catalog: catalog.filter(version => version.language !== lang),
    grouping: 'alphabetical',
    query: '',
    uiLanguage: lang,
    labels: VERSION_CATALOG_LABELS,
  })[0]

  return otherLanguagesSection
    ? [
        ...primarySections,
        {
          key: 'other-languages',
          titleKey: 'offlineSetup.section.otherLanguages',
          collapsedByDefault: true,
          data: otherLanguagesSection.data,
        },
      ]
    : primarySections
}

const getReadableBibleSections = (lang: ResourceLanguage): OfflineSetupSection[] => {
  const requiredVersionId = getDefaultBibleVersion(lang)
  const catalogSections = getBibleFolderCatalogSections('reading', lang).reduce(
    (result, section) => {
      const options = section.data.reduce<OfflineSetupOption[]>((sectionOptions, version) => {
        if (version.id !== requiredVersionId) {
          sectionOptions.push(createBibleOption(version.id, lang, false, version.displayName))
        }
        return sectionOptions
      }, [])
      if (options.length) {
        result.push({
          id: section.key === 'other-languages' ? 'other-languages' : `bible-${section.key}`,
          titleKey: section.titleKey,
          collapsedByDefault: section.collapsedByDefault,
          options,
        })
      }
      return result
    },
    [] as OfflineSetupSection[]
  )

  return [
    {
      id: 'required-bible',
      options: [createBibleOption(requiredVersionId, lang, true)],
    },
    ...catalogSections,
  ]
}

const getStrongSections = (lang: ResourceLanguage): OfflineSetupSection[] => {
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
    ...getBibleFolderCatalogSections('strong', lang).map(section => ({
      id: section.key === 'other-languages' ? 'other-languages' : `strong-bible-${section.key}`,
      titleKey: section.titleKey,
      collapsedByDefault: section.collapsedByDefault,
      options: section.data.map(version =>
        createStrongBibleOption(version.id as StrongBibleVersionId, lang, version.displayName)
      ),
    })),
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
      options: [
        ...primaryDatabaseIds.map(databaseId => createDatabaseOption(databaseId, lang, lang)),
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
      collapsedByDefault: true,
      options: [
        ...(['DICTIONNAIRE', 'NAVE'] as const),
        ...(otherLang === 'fr' ? (['MHY'] as const) : []),
        'TIMELINE' as const,
      ].map(databaseId => createDatabaseOption(databaseId, otherLang, lang)),
    },
  ]
}

const createInterlinearOption = (lang: ResourceLanguage): OfflineSetupOption => ({
  id: `bible-interlinear:${lang}`,
  label: '',
  labelKey: `offlineSetup.option.interlinear.${lang}`,
  language: lang,
  requires: ['bible:BHG'],
  selections: [
    { kind: 'bible', versionId: 'BHG' },
    { kind: 'bible-interlinear', lang },
  ],
})

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
  {
    id: 'interlinear',
    titleKey: 'offlineSetup.section.interlinearLanguages',
    options: [createInterlinearOption(lang)],
  },
  {
    id: 'other-languages',
    titleKey: 'offlineSetup.section.otherLanguages',
    collapsedByDefault: true,
    options: [createInterlinearOption(lang === 'fr' ? 'en' : 'fr')],
  },
]

const flattenResourceSections = (sections: OfflineSetupSection[]): OfflineSetupSection[] => {
  const options: OfflineSetupOption[] = []
  let otherLanguages: OfflineSetupSection | undefined

  for (const section of sections) {
    if (section.id === 'other-languages') {
      otherLanguages = section
    } else {
      options.push(...section.options)
    }
  }

  return [{ id: 'resources', options }, ...(otherLanguages ? [otherLanguages] : [])]
}

export const getOfflineSetupFolderSections = (
  folderId: OfflineSetupFolderId,
  lang: ResourceLanguage
): OfflineSetupSection[] => {
  switch (folderId) {
    case 'read-bible':
      return flattenResourceSections(getReadableBibleSections(lang))
    case 'understand-words':
      return flattenResourceSections(getStrongSections(lang))
    case 'explore-bible':
      return flattenResourceSections(getExploreSections(lang))
    case 'original-languages':
      return flattenResourceSections(getOriginalLanguageSections(lang))
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
