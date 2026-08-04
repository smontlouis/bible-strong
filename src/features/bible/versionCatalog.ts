import type {
  BibleVersionLanguage,
  TranslationReadingProfile,
  Version,
} from '~helpers/bibleVersions'

export type BibleVersionGrouping = 'alphabetical' | 'language' | 'style'
export type BibleVersionAvailability = 'all' | 'downloaded'

export type VersionCatalogItem = Version & {
  displayName: string
}

export type VersionCatalogLabels = {
  languages: Record<BibleVersionLanguage, string>
  profiles: Record<TranslationReadingProfile, string>
  other: string
}

export type VersionCatalogSection = {
  key: string
  title: string
  data: VersionCatalogItem[]
  readingProfile?: TranslationReadingProfile
}

export const getVersionCatalogLocation = (sections: VersionCatalogSection[], versionId: string) => {
  for (const [sectionIndex, section] of sections.entries()) {
    const itemIndex = section.data.findIndex(version => version.id === versionId)
    if (itemIndex >= 0) return { sectionIndex, itemIndex }
  }
  return null
}

export const filterVersionCatalogByAvailability = (
  catalog: Version[],
  availability: BibleVersionAvailability,
  downloadedVersionIds: ReadonlySet<string>
) =>
  availability === 'downloaded'
    ? catalog.filter(version => downloadedVersionIds.has(version.id))
    : catalog

type GetVersionCatalogSectionsOptions = {
  catalog: Version[]
  grouping: BibleVersionGrouping
  query: string
  uiLanguage: 'fr' | 'en'
  labels: VersionCatalogLabels
}

const READING_PROFILE_ORDER: TranslationReadingProfile[] = [
  'word-for-word',
  'balanced',
  'thought-for-thought',
  'paraphrase',
]

const normalizeSearchText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()

export const getVersionDisplayName = (version: Version, uiLanguage: 'fr' | 'en') =>
  uiLanguage === 'en' ? version.name_en || version.name : version.name

const prepareCatalog = (
  catalog: Version[],
  query: string,
  uiLanguage: 'fr' | 'en'
): VersionCatalogItem[] => {
  const normalizedQuery = normalizeSearchText(query.trim())

  return catalog
    .filter(version => {
      if (!normalizedQuery) return true

      return normalizeSearchText(
        [version.id, version.name, version.name_en].filter(Boolean).join(' ')
      ).includes(normalizedQuery)
    })
    .map(version => ({
      ...version,
      displayName: getVersionDisplayName(version, uiLanguage),
    }))
    .sort((left, right) => {
      const byName = left.displayName.localeCompare(right.displayName, uiLanguage, {
        sensitivity: 'base',
      })
      return byName || left.id.localeCompare(right.id, 'en', { sensitivity: 'base' })
    })
}

export const getVersionCatalogSections = ({
  catalog,
  grouping,
  query,
  uiLanguage,
  labels,
}: GetVersionCatalogSectionsOptions): VersionCatalogSection[] => {
  const matchingVersions = prepareCatalog(catalog, query, uiLanguage)
  if (!matchingVersions.length) return []

  if (grouping === 'alphabetical') {
    return [{ key: 'alphabetical', title: '', data: matchingVersions }]
  }

  if (grouping === 'language') {
    const versionsByLanguage = matchingVersions.reduce((groupedVersions, version) => {
      const languageVersions = groupedVersions.get(version.language) || []
      groupedVersions.set(version.language, [...languageVersions, version])
      return groupedVersions
    }, new Map<BibleVersionLanguage, VersionCatalogItem[]>())
    const languages = [...versionsByLanguage.keys()].sort((left, right) => {
      if (left === uiLanguage) return -1
      if (right === uiLanguage) return 1
      if (left === 'he-grc') return -1
      if (right === 'he-grc') return 1
      return labels.languages[left].localeCompare(labels.languages[right], uiLanguage, {
        sensitivity: 'base',
      })
    })

    return languages.map(language => ({
      key: language,
      title: labels.languages[language],
      data: versionsByLanguage.get(language) || [],
    }))
  }

  const sections = READING_PROFILE_ORDER.flatMap(readingProfile => {
    const data = matchingVersions.filter(version => version.readingProfile === readingProfile)
    return data.length
      ? [
          {
            key: readingProfile,
            title: labels.profiles[readingProfile],
            data,
            readingProfile,
          },
        ]
      : []
  })
  const other = matchingVersions.filter(version => version.readingProfile === null)

  return other.length ? [...sections, { key: 'other', title: labels.other, data: other }] : sections
}
