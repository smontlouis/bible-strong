import { getLocalResourceAvailability } from '~features/resources/resourceAvailability'
import books from '~assets/bible_versions/books-desc'
import type { ResourceLanguage } from './databaseTypes'
import { versions } from './bibleVersions'
import { getBibleVersionCoverage, type BibleVersionCoverage } from './biblesDb'
import { getInterlinearSidecarAvailability } from './interlinearBibleSidecar'
import { isStrongCapableBibleVersion, resolveStrongBibleVersion } from './strongBiblePublications'
import { getStrongBibleSidecarAvailability } from './strongBibleSidecar'
import type { BibleTab, VersionCode } from '~state/tabs'

export type BibleTabResourceState = Pick<
  BibleTab['data'],
  | 'selectedVersion'
  | 'strongMode'
  | 'interlinearMode'
  | 'interlinearLocale'
  | 'parallelVersions'
  | 'selectedBook'
  | 'selectedChapter'
  | 'selectedVerse'
>

export interface BibleTabResourceResolutionDependencies {
  isBibleAvailable: (versionId: string) => Promise<boolean>
  isInterlinearIndexAvailable: (locale: ResourceLanguage) => Promise<boolean>
  isStrongSidecarAvailable: (versionId: string) => Promise<boolean>
  getBibleCoverage: (versionId: string) => Promise<BibleVersionCoverage>
}

const defaultDependencies: BibleTabResourceResolutionDependencies = {
  isBibleAvailable: async versionId =>
    (await getLocalResourceAvailability({ kind: 'bible', versionId })).status === 'available',
  isInterlinearIndexAvailable: async locale =>
    (await getInterlinearSidecarAvailability(locale)).status === 'available',
  isStrongSidecarAvailable: async versionId =>
    isStrongCapableBibleVersion(versionId) &&
    (await getStrongBibleSidecarAvailability(versionId)).status === 'available',
  getBibleCoverage: getBibleVersionCoverage,
}

const getLegacyInterlinearLocale = (versionId: string): ResourceLanguage | undefined => {
  if (versionId === 'INT') return 'fr'
  if (versionId === 'INT_EN') return 'en'
  return undefined
}

export const resolveBibleTabResources = async (
  data: BibleTabResourceState,
  applicationLanguage: ResourceLanguage,
  dependencies: BibleTabResourceResolutionDependencies = defaultDependencies
): Promise<BibleTabResourceState> => {
  const availabilityCache = new Map<string, Promise<boolean>>()
  const isBibleAvailable = (versionId: string) => {
    const cached = availabilityCache.get(versionId)
    if (cached) return cached
    const availability = dependencies.isBibleAvailable(versionId)
    availabilityCache.set(versionId, availability)
    return availability
  }

  const resolvedStrong = resolveStrongBibleVersion(data.selectedVersion, data.strongMode)
  let nextData =
    resolvedStrong.versionId === data.selectedVersion &&
    resolvedStrong.strongMode === data.strongMode
      ? data
      : {
          ...data,
          selectedVersion: resolvedStrong.versionId as VersionCode,
          strongMode: resolvedStrong.strongMode,
        }

  const legacyLocale = getLegacyInterlinearLocale(nextData.selectedVersion)
  if (legacyLocale) {
    if (await isBibleAvailable('BHG')) {
      const hasLocalizedIndex = await dependencies.isInterlinearIndexAvailable(legacyLocale)
      nextData = {
        ...selectResourceVersion(nextData, 'BHG'),
        interlinearMode: hasLocalizedIndex ? 'interlinear' : 'hidden',
        interlinearLocale: legacyLocale,
      }
    } else if (!(await isBibleAvailable(nextData.selectedVersion))) {
      nextData = await selectInstalledFallback(
        nextData,
        applicationLanguage,
        isBibleAvailable,
        dependencies.getBibleCoverage
      )
    }
  } else if (!(await isBibleAvailable(nextData.selectedVersion))) {
    nextData = await selectInstalledFallback(
      nextData,
      applicationLanguage,
      isBibleAvailable,
      dependencies.getBibleCoverage
    )
  }

  if (nextData.strongMode === 'reverse-interlinear') {
    const fallbackLanguage: ResourceLanguage = applicationLanguage === 'fr' ? 'en' : 'fr'
    const hasBhg = await isBibleAvailable('BHG')
    const hasStepIndex =
      hasBhg &&
      ((await dependencies.isInterlinearIndexAvailable(applicationLanguage)) ||
        (await dependencies.isInterlinearIndexAvailable(fallbackLanguage)))
    const hasStrongSidecar = await dependencies.isStrongSidecarAvailable(nextData.selectedVersion)

    if (!hasStepIndex || !hasStrongSidecar) {
      nextData = {
        ...nextData,
        strongMode: 'hidden',
      }
    }
  }

  const resolvedParallelVersions: VersionCode[] = []
  for (const parallelVersion of nextData.parallelVersions) {
    const resolvedVersion = resolveStrongBibleVersion(parallelVersion).versionId as VersionCode
    const parallelLegacyLocale = getLegacyInterlinearLocale(resolvedVersion)
    let availableVersion: VersionCode | undefined

    if (parallelLegacyLocale && (await isBibleAvailable('BHG'))) {
      availableVersion = 'BHG'
    } else if (await isBibleAvailable(resolvedVersion)) {
      availableVersion = resolvedVersion
    }

    if (
      availableVersion &&
      availableVersion !== nextData.selectedVersion &&
      !resolvedParallelVersions.includes(availableVersion)
    ) {
      resolvedParallelVersions.push(availableVersion)
    }
  }

  const parallelVersionsUnchanged =
    resolvedParallelVersions.length === nextData.parallelVersions.length &&
    resolvedParallelVersions.every(
      (parallelVersion, index) => parallelVersion === nextData.parallelVersions[index]
    )

  if (parallelVersionsUnchanged) return nextData
  return {
    ...nextData,
    parallelVersions: resolvedParallelVersions,
  }
}

const selectInstalledFallback = async (
  data: BibleTabResourceState,
  applicationLanguage: ResourceLanguage,
  isBibleAvailable: (versionId: string) => Promise<boolean>,
  getBibleCoverage: (versionId: string) => Promise<BibleVersionCoverage>
): Promise<BibleTabResourceState> => {
  const selectedLanguage = versions[data.selectedVersion]?.language
  const preferredDefault =
    selectedLanguage === 'en' || selectedLanguage === 'fr' ? selectedLanguage : applicationLanguage
  const candidates: VersionCode[] = preferredDefault === 'en' ? ['KJV', 'LSG'] : ['LSG', 'KJV']

  for (const candidate of candidates) {
    if (await isBibleAvailable(candidate)) {
      const selectedData = selectResourceVersion(data, candidate)
      try {
        return alignBibleLocation(selectedData, await getBibleCoverage(candidate))
      } catch {
        return selectedData
      }
    }
  }

  return data
}

const alignBibleLocation = (
  data: BibleTabResourceState,
  coverage: BibleVersionCoverage
): BibleTabResourceState => {
  const currentBook = Number(data.selectedBook.Numero)
  const bookNumber = coverage.books.includes(currentBook) ? currentBook : coverage.books[0]
  if (!bookNumber) return data

  const chapters = coverage.chaptersByBook[bookNumber] ?? []
  const currentChapter = Number(data.selectedChapter)
  const chapter = chapters.includes(currentChapter) ? currentChapter : chapters[0]
  if (!chapter) return data

  const maxVerse = coverage.verseCountByBookChapter[`${bookNumber}-${chapter}`] ?? 1
  const verse = Math.min(Math.max(Number(data.selectedVerse) || 1, 1), maxVerse)
  const book = books.find(candidate => candidate.Numero === bookNumber)
  if (!book) return data

  if (
    bookNumber === currentBook &&
    chapter === currentChapter &&
    verse === Number(data.selectedVerse)
  ) {
    return data
  }

  return {
    ...data,
    selectedBook: book,
    selectedChapter: chapter,
    selectedVerse: verse,
  }
}

const selectResourceVersion = (
  data: BibleTabResourceState,
  selectedVersion: VersionCode
): BibleTabResourceState => {
  const resolved = resolveStrongBibleVersion(selectedVersion)
  const isBhg = resolved.versionId === 'BHG'
  return {
    ...data,
    selectedVersion: resolved.versionId as VersionCode,
    strongMode: resolved.strongMode,
    interlinearMode: isBhg ? 'hidden' : undefined,
    interlinearLocale: isBhg ? data.interlinearLocale : undefined,
  }
}
