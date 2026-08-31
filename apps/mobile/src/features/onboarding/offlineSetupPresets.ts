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
  label = getBibleLabel(versionId, lang)
): OfflineSetupOption => ({
  id: `bible:${versionId}`,
  label,
  description: versions[versionId].c,
  language: versions[versionId].language,
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
  requires: [`bible:${versionId}`, 'strong-lexicon:core'],
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
  const suggestedVersionId = getDefaultBibleVersion(lang)
  const catalogSections = getBibleFolderCatalogSections('reading', lang).reduce(
    (result, section) => {
      const options = section.data.reduce<OfflineSetupOption[]>((sectionOptions, version) => {
        if (version.id !== suggestedVersionId) {
          sectionOptions.push(createBibleOption(version.id, lang, version.displayName))
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
      id: 'suggested-bible',
      options: [createBibleOption(suggestedVersionId, lang)],
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
        {
          id: `commentaries-classics:${lang}`,
          label: '',
          labelKey: 'offlineSetup.option.classicCommentaries',
          descriptionKey: 'offlineSetup.option.classicCommentariesDescription',
          language: lang,
          selections:
            lang === 'fr'
              ? [
                  { kind: 'commentary', resourceId: 'barnes', lang },
                  { kind: 'commentary', resourceId: 'acbc', lang },
                  { kind: 'commentary', resourceId: 'MHY', lang },
                ]
              : [
                  { kind: 'commentary', resourceId: 'barnes', lang },
                  { kind: 'commentary', resourceId: 'acbc', lang },
                  { kind: 'commentary', resourceId: 'mhcc', lang },
                ],
        },
        ...primaryDatabaseIds.map(databaseId => createDatabaseOption(databaseId, lang, lang)),
        // Cross references use one shared physical copy with a canonical identity.
        createDatabaseOption('TRESOR', 'fr', 'fr'),
        {
          id: 'strong-lexicon:entities',
          label: '',
          labelKey: 'offlineSetup.resources.entities',
          descriptionKey: 'offlineSetup.option.entitiesDescription',
          requires: ['strong-lexicon:core'],
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

const getFolderOptions = (
  lang: ResourceLanguage
): Record<OfflineSetupFolderId, OfflineSetupOption[]> => {
  const entries = OFFLINE_SETUP_FOLDER_IDS.map(folderId => [
    folderId,
    getOfflineSetupFolderSections(folderId, lang).flatMap(section => section.options),
  ])
  return Object.fromEntries(entries) as Record<OfflineSetupFolderId, OfflineSetupOption[]>
}

const collectDependencyOptionIds = (
  option: OfflineSetupOption,
  folderOptions: Record<OfflineSetupFolderId, OfflineSetupOption[]>
): Set<string> => {
  const optionIds = new Set<string>()
  const pendingIds = [option.id]

  while (pendingIds.length > 0) {
    const optionId = pendingIds.shift()
    if (!optionId || optionIds.has(optionId)) continue
    optionIds.add(optionId)

    for (const folderId of OFFLINE_SETUP_FOLDER_IDS) {
      for (const candidate of folderOptions[folderId]) {
        if (candidate.id === optionId) pendingIds.push(...(candidate.requires ?? []))
      }
    }
  }

  return optionIds
}

const collectDependentOptionIds = (
  optionId: string,
  selectedIdsByFolder: OfflineSetupFolderOptionIds,
  folderOptions: Record<OfflineSetupFolderId, OfflineSetupOption[]>
): Set<string> => {
  const removedIds = new Set([optionId])
  let foundDependent = true

  while (foundDependent) {
    foundDependent = false
    for (const folderId of OFFLINE_SETUP_FOLDER_IDS) {
      const selectedIds = new Set(selectedIdsByFolder[folderId])
      for (const candidate of folderOptions[folderId]) {
        if (!selectedIds.has(candidate.id) || removedIds.has(candidate.id)) continue
        if (!candidate.requires?.some(requiredId => removedIds.has(requiredId))) continue
        removedIds.add(candidate.id)
        foundDependent = true
      }
    }
  }

  return removedIds
}

const addOptionIdsToFolders = (
  selectedIdsByFolder: OfflineSetupFolderOptionIds,
  optionIds: ReadonlySet<string>,
  folderOptions: Record<OfflineSetupFolderId, OfflineSetupOption[]>
): OfflineSetupFolderOptionIds => {
  const result = { ...selectedIdsByFolder }

  for (const folderId of OFFLINE_SETUP_FOLDER_IDS) {
    const visibleOptionIds = new Set(folderOptions[folderId].map(option => option.id))
    const additions = Array.from(optionIds).filter(optionId => visibleOptionIds.has(optionId))
    result[folderId] = [...new Set([...selectedIdsByFolder[folderId], ...additions])]
  }

  return result
}

const removeOptionIdsFromFolders = (
  selectedIdsByFolder: OfflineSetupFolderOptionIds,
  optionIds: ReadonlySet<string>
): OfflineSetupFolderOptionIds => {
  const result = { ...selectedIdsByFolder }
  for (const folderId of OFFLINE_SETUP_FOLDER_IDS) {
    result[folderId] = selectedIdsByFolder[folderId].filter(optionId => !optionIds.has(optionId))
  }
  return result
}

export const toggleOfflineSetupFolderOption = (
  selectedIdsByFolder: OfflineSetupFolderOptionIds,
  sourceFolderId: OfflineSetupFolderId,
  option: OfflineSetupOption,
  lang: ResourceLanguage
): OfflineSetupFolderOptionIds => {
  const folderOptions = getFolderOptions(lang)
  const isSelected = selectedIdsByFolder[sourceFolderId].includes(option.id)
  if (!isSelected) {
    const dependencyOptionIds = collectDependencyOptionIds(option, folderOptions)
    return addOptionIdsToFolders(selectedIdsByFolder, dependencyOptionIds, folderOptions)
  }

  const removedOptionIds = collectDependentOptionIds(option.id, selectedIdsByFolder, folderOptions)
  return removeOptionIdsFromFolders(selectedIdsByFolder, removedOptionIds)
}

export const getOfflineSetupLockedOptionIds = (
  selectedIdsByFolder: OfflineSetupFolderOptionIds,
  lang: ResourceLanguage
): Set<string> => {
  const folderOptions = getFolderOptions(lang)
  const lockedIds = new Set<string>()

  for (const folderId of OFFLINE_SETUP_FOLDER_IDS) {
    const selectedIds = new Set(selectedIdsByFolder[folderId])
    for (const option of folderOptions[folderId]) {
      if (!selectedIds.has(option.id)) continue

      const dependencyIds = collectDependencyOptionIds(option, folderOptions)
      dependencyIds.delete(option.id)
      dependencyIds.forEach(dependencyId => lockedIds.add(dependencyId))
    }
  }

  return lockedIds
}

const getUniqueResourceSelections = (
  selections: OnboardingResourceSelection[]
): OnboardingResourceSelection[] => [
  ...new Map(
    selections.map(selection => [getOnboardingResourceSelectionId(selection), selection])
  ).values(),
]

export const resolveOfflineSetupFolderSelections = (
  folderId: OfflineSetupFolderId,
  optionIds: readonly string[],
  lang: ResourceLanguage
): OnboardingResourceSelection[] => {
  const selectedIds = new Set(optionIds)
  const selections = getOfflineSetupFolderSections(folderId, lang).flatMap(section =>
    section.options.flatMap(option => (selectedIds.has(option.id) ? option.selections : []))
  )

  return getUniqueResourceSelections(selections)
}

export const resolveOfflineSetupFolderOptionIds = (
  optionIdsByFolder: OfflineSetupFolderOptionIds,
  lang: ResourceLanguage
): OnboardingResourceSelection[] => {
  const selections = OFFLINE_SETUP_FOLDER_IDS.flatMap(folderId =>
    resolveOfflineSetupFolderSelections(folderId, optionIdsByFolder[folderId], lang)
  )

  return getUniqueResourceSelections(selections)
}
