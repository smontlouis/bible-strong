import Fuse, { type FuseResultMatch, type IFuseOptions } from 'fuse.js'
import type { MatchRange, SearchEntityResult } from './searchResultTypes'

export type SearchableTextItem = {
  title: string
  description?: string
}

export const normalizeDisplayedText = (value: string = '') => value.replace(/\n/g, '')

export const removeAccents = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

export const normalizeSearchText = (value: string) => removeAccents(value).toLowerCase()

const getFuzzyValue = <T>(obj: T, path: string | string[]): readonly string[] | string => {
  const value = Fuse.config.getFn(obj, path)
  return Array.isArray(value)
    ? value.map(item => removeAccents(String(item)))
    : removeAccents(String(value || ''))
}

export const defaultSearchFuzzyOptions: IFuseOptions<SearchableTextItem> = {
  keys: ['title', 'description'],
  includeMatches: true,
  threshold: 0.15,
  ignoreDiacritics: true,
}

export const relationTargetFuzzyOptions: IFuseOptions<SearchEntityResult> = {
  keys: [
    { name: 'title', weight: 0.7 },
    { name: 'description', weight: 0.3 },
  ],
  threshold: 0.22,
  ignoreLocation: true,
  ignoreFieldNorm: true,
  includeMatches: true,
  minMatchCharLength: 3,
  getFn: getFuzzyValue,
}

export const mergeRanges = (ranges: readonly MatchRange[]) =>
  ranges
    .slice()
    .sort((a, b) => a[0] - b[0])
    .reduce<MatchRange[]>((merged, range) => {
      const previous = merged[merged.length - 1]
      if (previous && range[0] <= previous[1] + 1) {
        merged[merged.length - 1] = [previous[0], Math.max(previous[1], range[1])]
      } else {
        merged.push([range[0], range[1]])
      }
      return merged
    }, [])

const findExactNormalizedRange = (value: string | undefined, keyword: string): MatchRange[] => {
  if (!value) return []

  const normalizedValue = normalizeSearchText(value)
  const normalizedKeyword = normalizeSearchText(keyword.trim())
  if (normalizedKeyword.length < 3) return []

  const start = normalizedValue.indexOf(normalizedKeyword)
  if (start === -1) return []

  return [[start, start + normalizedKeyword.length - 1]]
}

const getExactMatches = (
  target: SearchEntityResult,
  keyword: string
): readonly FuseResultMatch[] => {
  const titleRanges = findExactNormalizedRange(target.title, keyword)
  const descriptionRanges = findExactNormalizedRange(target.description, keyword)
  const matches: FuseResultMatch[] = []

  if (titleRanges.length) {
    matches.push({ key: 'title', value: target.title, indices: titleRanges })
  }
  if (target.description && descriptionRanges.length) {
    matches.push({ key: 'description', value: target.description, indices: descriptionRanges })
  }

  return matches
}

export const searchWithMatches = <T extends SearchableTextItem>(
  targets: T[],
  keyword: string,
  options: IFuseOptions<T> = defaultSearchFuzzyOptions as IFuseOptions<T>
): (T & { matches?: readonly FuseResultMatch[] })[] => {
  const trimmed = keyword.trim()
  if (trimmed.length < 2) return []

  return new Fuse(targets, options).search(trimmed).map(result => ({
    ...result.item,
    matches: result.matches,
  }))
}

export const searchRelationTargetsWithMatches = (
  targets: SearchEntityResult[],
  keyword: string
): SearchEntityResult[] => {
  const trimmed = keyword.trim()
  if (!trimmed) return targets

  return new Fuse(targets, relationTargetFuzzyOptions)
    .search(removeAccents(trimmed))
    .map(result => ({
      ...result.item,
      matches: getExactMatches(result.item, trimmed),
    }))
    .filter(result => result.matches?.length)
}
