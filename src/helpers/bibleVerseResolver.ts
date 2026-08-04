import type { BibleRecoveryAction } from './bibleErrors'

export type BibleVerseResolutionStatus = 'resolved' | 'partial' | 'reference-only'

export type BibleVerseResolution = {
  status: BibleVerseResolutionStatus
  version?: string
  texts: Record<string, string>
  missingVerseKeys: string[]
  recoveries?: BibleRecoveryAction[]
}

export const shouldShowBibleReferenceUnavailable = (status: BibleVerseResolutionStatus): boolean =>
  status === 'reference-only'

type ResolveBibleVersesOptions = {
  verseKeys: string[]
  preferredVersion?: string
  defaultVersion: string
}

export const getBibleVerseResolutionRequestKey = ({
  verseKeys,
  preferredVersion,
  defaultVersion,
}: ResolveBibleVersesOptions): string =>
  JSON.stringify([verseKeys, preferredVersion || '', defaultVersion])

type BibleVerseResolverDependencies = {
  loadVerseTexts: (version: string, verseKeys: string[]) => Promise<Record<string, string>>
  getAvailability?: (version: string) => Promise<{
    status: 'available' | 'unavailable'
    recoveries?: BibleRecoveryAction[]
  }>
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

export const resolveBibleVerses = async (
  { verseKeys, preferredVersion, defaultVersion }: ResolveBibleVersesOptions,
  dependencies: BibleVerseResolverDependencies
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

  const version = preferredVersion || defaultVersion
  const texts = await dependencies.loadVerseTexts(version, requestedVerseKeys)
  const missingVerseKeys = requestedVerseKeys.filter(key => !texts[key])
  if (missingVerseKeys.length === 0) {
    return { status: 'resolved', version, texts, missingVerseKeys: [] }
  }
  if (Object.keys(texts).length > 0) {
    return {
      status: 'partial',
      version,
      texts,
      missingVerseKeys,
    }
  }

  const availability = await dependencies.getAvailability?.(version)
  return {
    status: 'reference-only',
    version,
    texts: {},
    missingVerseKeys,
    ...(availability?.status === 'unavailable' && availability.recoveries
      ? { recoveries: availability.recoveries }
      : {}),
  }
}
