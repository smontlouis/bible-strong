import type {
  DictionaryDirectoryItem,
  DictionaryDirectorySource,
  DictionaryPassageDiscoveryEntry,
} from '~features/resources/dictionaryAccess'
import type { ResourceLanguage } from '~helpers/databaseTypes'

export type DictionaryPassageConcept = {
  key: string
  label: string
  correspondenceId?: string
  sources: DictionaryPassageDiscoveryEntry[]
}

type DictionaryArticleIdentity = {
  correspondenceId?: string
  work: string
  language: ResourceLanguage
  entryId?: number
  word: string
}

const sourcePriority = (source: {
  resource: { language: ResourceLanguage }
  abbreviation: string
}) => `${source.resource.language}:${source.abbreviation}`

export const pickPreferredDictionarySource = <
  T extends { resource: { language: ResourceLanguage }; abbreviation: string },
>(
  sources: readonly T[],
  preferredLanguage: ResourceLanguage
): T | undefined =>
  [...sources].sort((left, right) => {
    const languageDifference =
      Number(right.resource.language === preferredLanguage) -
      Number(left.resource.language === preferredLanguage)
    return languageDifference || sourcePriority(left).localeCompare(sourcePriority(right))
  })[0]

export const groupDictionaryPassageEntries = (
  entries: readonly DictionaryPassageDiscoveryEntry[],
  preferredLanguage: ResourceLanguage
): DictionaryPassageConcept[] => {
  const groups = new Map<string, DictionaryPassageDiscoveryEntry[]>()
  for (const entry of entries) {
    const key = entry.correspondenceId
      ? `correspondence:${entry.correspondenceId}`
      : `entry:${entry.resource.work}:${entry.resource.language}:${entry.id}`
    groups.set(key, [...(groups.get(key) ?? []), entry])
  }
  return [...groups.entries()]
    .map(([key, sources]) => {
      const preferred = pickPreferredDictionarySource(sources, preferredLanguage) ?? sources[0]
      return {
        key,
        label: preferred.word,
        ...(preferred.correspondenceId ? { correspondenceId: preferred.correspondenceId } : {}),
        sources: [...sources].sort((left, right) =>
          sourcePriority(left).localeCompare(sourcePriority(right))
        ),
      }
    })
    .sort((left, right) => left.label.localeCompare(right.label))
}

export const findDirectoryItemForArticle = (
  items: readonly DictionaryDirectoryItem[],
  identity: DictionaryArticleIdentity
): DictionaryDirectoryItem | undefined => {
  if (identity.correspondenceId) {
    const correspondence = items.find(item => item.correspondenceId === identity.correspondenceId)
    if (correspondence) return correspondence
  }

  const normalizedWord = identity.word.trim().toLocaleLowerCase()
  return items.find(item =>
    item.sources.some(
      source =>
        source.resource.work === identity.work &&
        source.resource.language === identity.language &&
        (identity.entryId !== undefined
          ? source.id === identity.entryId
          : source.word.trim().toLocaleLowerCase() === normalizedWord)
    )
  )
}

export const directorySourceFromPassageEntry = (
  entry: DictionaryPassageDiscoveryEntry
): DictionaryDirectorySource => ({
  resource: entry.resource,
  resourceId: entry.resourceId,
  title: entry.title,
  abbreviation: entry.abbreviation,
  id: entry.id,
  word: entry.word,
  normalizedWord: entry.normalizedWord,
})

export const directoryItemFromPassageConcept = (
  concept: DictionaryPassageConcept
): DictionaryDirectoryItem => ({
  key: concept.key,
  label: concept.label,
  normalizedLabel: concept.label.toLocaleLowerCase(),
  ...(concept.correspondenceId ? { correspondenceId: concept.correspondenceId } : {}),
  sources: concept.sources.map(directorySourceFromPassageEntry),
})
