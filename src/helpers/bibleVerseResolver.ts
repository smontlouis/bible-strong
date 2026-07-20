import { getInstalledVersions, getMultipleVerses } from './biblesDb'

export type BibleVerseResolutionStatus = 'resolved' | 'partial' | 'reference-only'

export type BibleVerseResolution = {
  status: BibleVerseResolutionStatus
  version?: string
  texts: Record<string, string>
  missingVerseKeys: string[]
}

type ResolveBibleVersesOptions = {
  verseKeys: string[]
  preferredVersion?: string
  defaultVersion: string
}

type BibleVerseResolverDependencies = {
  getInstalledVersions: () => Promise<string[]>
  getMultipleVerses: (version: string, verseKeys: string[]) => Promise<Record<string, string>>
}

export const getBibleLocationVerseKeys = ({
  book,
  chapter,
  verse,
  focusVerses,
}: {
  book?: number
  chapter?: number
  verse?: number
  focusVerses?: number[]
}): string[] => {
  if (!book || !chapter) return []
  return (focusVerses?.length ? focusVerses : [verse || 1]).map(
    focusVerse => `${book}-${chapter}-${focusVerse}`
  )
}

const defaultDependencies: BibleVerseResolverDependencies = {
  getInstalledVersions,
  getMultipleVerses,
}

const unique = (values: (string | undefined)[]): string[] =>
  values.filter(
    (value, index): value is string => Boolean(value) && values.indexOf(value) === index
  )

export const resolveBibleVerses = async (
  { verseKeys, preferredVersion, defaultVersion }: ResolveBibleVersesOptions,
  dependencies: BibleVerseResolverDependencies = defaultDependencies
): Promise<BibleVerseResolution> => {
  const requestedVerseKeys = [...new Set(verseKeys)]
  if (!requestedVerseKeys.length) {
    return {
      status: 'resolved',
      version: preferredVersion || defaultVersion,
      texts: {},
      missingVerseKeys: [],
    }
  }

  let bestVersion: string | undefined
  let bestTexts: Record<string, string> = {}

  const tryCandidates = async (candidates: string[]): Promise<BibleVerseResolution | undefined> => {
    for (const version of candidates) {
      const texts = await dependencies.getMultipleVerses(version, requestedVerseKeys)
      const foundCount = requestedVerseKeys.filter(key => Boolean(texts[key])).length

      if (foundCount > Object.keys(bestTexts).length) {
        bestVersion = version
        bestTexts = texts
      }

      if (foundCount === requestedVerseKeys.length) {
        return {
          status: 'resolved',
          version,
          texts,
          missingVerseKeys: [],
        }
      }
    }
    return undefined
  }

  const priorityCandidates = unique([preferredVersion, defaultVersion])
  const priorityResolution = await tryCandidates(priorityCandidates)
  if (priorityResolution) return priorityResolution

  const installedVersions = await dependencies.getInstalledVersions()
  const fallbackResolution = await tryCandidates(
    installedVersions.filter(version => !priorityCandidates.includes(version))
  )
  if (fallbackResolution) return fallbackResolution

  // Keep the best partial result when translations use different verse boundaries.
  const missingVerseKeys = requestedVerseKeys.filter(key => !bestTexts[key])
  if (bestVersion) {
    return {
      status: 'partial',
      version: bestVersion,
      texts: bestTexts,
      missingVerseKeys,
    }
  }

  return {
    status: 'reference-only',
    version: undefined,
    texts: {},
    missingVerseKeys,
  }
}
