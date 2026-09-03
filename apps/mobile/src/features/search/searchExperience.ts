import { getBooksForCanon } from '~helpers/bibleBookCatalog'
import { getBibleVersionCanonId } from '~helpers/bibleVersions'
import type { SearchSortOrder } from '~helpers/biblesDb'
import type {
  SearchCanon,
  SearchFilters,
  SearchItemFilters,
  SearchItemType,
  SearchSection,
} from '~state/searchFilters'
import {
  DEFAULT_BIBLE_VERSION_FILTER,
  resolveSearchVersionFilter,
} from '~state/searchVersionFilter'

export interface SearchExperienceAdapter {
  readFilters(): SearchFilters
  installedVersions(): string[]
  defaultBibleVersion(): string
  writeSection(value: SearchSection): void
  writeCanon(value: SearchCanon): void
  writeBook(value: number): void
  writeSelectedVersion(value: string): void
  writeSortOrder(value: SearchSortOrder): void
  writeItemFilters(value: SearchItemFilters): void
  persist(patch: Partial<SearchFilters>): void
}

export const createSearchExperienceController = (
  adapter: SearchExperienceAdapter,
  itemFilterOrder: readonly SearchItemType[],
  allItemFilters: SearchItemFilters
) => {
  const persist = (patch: Partial<SearchFilters>) => adapter.persist(patch)

  return {
    setSection(value: SearchSection) {
      if (adapter.readFilters().section === value) return
      adapter.writeSection(value)
      persist({ section: value })
    },

    setBook(value: number) {
      if (adapter.readFilters().book === value) return
      adapter.writeBook(value)
      persist({ book: value })
    },

    setSortOrder(value: SearchSortOrder) {
      if (adapter.readFilters().sortOrder === value) return
      adapter.writeSortOrder(value)
      persist({ sortOrder: value })
    },

    selectVersion(value: string) {
      const current = adapter.readFilters()
      const version = resolveSearchVersionFilter(value, adapter.defaultBibleVersion())
      const versionCanon = getBibleVersionCanonId(version)
      const canon = current.canon && current.canon !== versionCanon ? '' : current.canon
      const book =
        current.book &&
        !getBooksForCanon(versionCanon).some(candidate => candidate.Numero === current.book)
          ? 0
          : current.book

      if (value === current.selectedVersion && canon === current.canon && book === current.book) {
        return
      }

      if (value !== current.selectedVersion) adapter.writeSelectedVersion(value)
      if (canon !== current.canon) adapter.writeCanon(canon)
      if (book !== current.book) adapter.writeBook(book)
      persist({ selectedVersion: value, canon, book })
    },

    selectCanon(value: SearchCanon) {
      const current = adapter.readFilters()
      const defaultVersion = adapter.defaultBibleVersion()
      const resolvedVersion = resolveSearchVersionFilter(current.selectedVersion, defaultVersion)
      const compatibleVersions = value
        ? adapter.installedVersions().filter(version => getBibleVersionCanonId(version) === value)
        : adapter.installedVersions()
      const selectedVersion = compatibleVersions.includes(resolvedVersion)
        ? current.selectedVersion
        : compatibleVersions.includes(defaultVersion)
          ? DEFAULT_BIBLE_VERSION_FILTER
          : compatibleVersions[0] || ''
      const book =
        value &&
        current.book &&
        !getBooksForCanon(value).some(candidate => candidate.Numero === current.book)
          ? 0
          : current.book

      adapter.writeCanon(value)
      if (selectedVersion !== current.selectedVersion) {
        adapter.writeSelectedVersion(selectedVersion)
      }
      if (book !== current.book) adapter.writeBook(book)
      persist({ canon: value, selectedVersion, book })
    },

    toggleItemFilter(type: SearchItemType): boolean {
      const current = adapter.readFilters().itemFilters
      const next = { ...current, [type]: !current[type] }
      if (!itemFilterOrder.some(itemType => next[itemType])) return false
      adapter.writeItemFilters(next)
      persist({ itemFilters: next })
      return true
    },

    resetItemFilters() {
      adapter.writeItemFilters(allItemFilters)
      persist({ itemFilters: allItemFilters })
    },

    resetPassageFilters() {
      adapter.writeSelectedVersion(DEFAULT_BIBLE_VERSION_FILTER)
      adapter.writeSection('')
      adapter.writeCanon('')
      adapter.writeBook(0)
      adapter.writeSortOrder('relevance')
      persist({
        selectedVersion: DEFAULT_BIBLE_VERSION_FILTER,
        section: '',
        canon: '',
        book: 0,
        sortOrder: 'relevance',
      })
    },
  }
}
