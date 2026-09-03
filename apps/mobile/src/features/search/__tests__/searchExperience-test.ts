import type { SearchFilters } from '~state/searchFilters'
import { DEFAULT_BIBLE_VERSION_FILTER } from '~state/searchVersionFilter'
import { createSearchExperienceController } from '../searchExperience'

jest.mock('~helpers/bibleVersions', () => ({
  getBibleVersionCanonId: (version: string) =>
    version === 'LSG' || version === 'KJV' ? 'protestant-66' : 'catholic-73',
}))

const allItemFilters = {
  passages: true,
  notes: true,
  links: true,
  studies: true,
  strong: true,
  dictionary: true,
  nave: true,
}

const createHarness = (
  overrides: Partial<SearchFilters> = {},
  searchableVersions: string[] = ['LSG', 'KJV']
) => {
  let filters: SearchFilters = {
    section: '',
    canon: '',
    book: 0,
    selectedVersion: DEFAULT_BIBLE_VERSION_FILTER,
    sortOrder: 'relevance',
    itemFilters: allItemFilters,
    ...overrides,
  }
  const write = <Key extends keyof SearchFilters>(key: Key, value: SearchFilters[Key]) => {
    filters = { ...filters, [key]: value }
  }
  const persist = jest.fn((patch: Partial<SearchFilters>) => {
    filters = { ...filters, ...patch }
  })
  const writeSelectedVersion = jest.fn((value: string) => write('selectedVersion', value))
  const controller = createSearchExperienceController(
    {
      readFilters: () => filters,
      searchableVersions: () => searchableVersions,
      defaultBibleVersion: () => 'LSG',
      writeSection: value => write('section', value),
      writeCanon: value => write('canon', value),
      writeBook: value => write('book', value),
      writeSelectedVersion,
      writeSortOrder: value => write('sortOrder', value),
      writeItemFilters: value => write('itemFilters', value),
      persist,
    },
    Object.keys(allItemFilters) as (keyof typeof allItemFilters)[],
    allItemFilters
  )
  return { controller, filters: () => filters, persist, writeSelectedVersion }
}

describe('searchExperience', () => {
  it('does not clear the default version when no Offline copy is installed', () => {
    const harness = createHarness({}, [])

    harness.controller.reconcileSelectedVersion()

    expect(harness.filters().selectedVersion).toBe(DEFAULT_BIBLE_VERSION_FILTER)
    expect(harness.persist).not.toHaveBeenCalled()
  })

  it('repairs an empty persisted version so passage search can report availability', () => {
    const harness = createHarness({ selectedVersion: '' }, [])

    harness.controller.reconcileSelectedVersion()

    expect(harness.filters().selectedVersion).toBe(DEFAULT_BIBLE_VERSION_FILTER)
  })

  it('keeps version, canon, and book filters compatible as one transition', () => {
    const harness = createHarness({ canon: 'protestant-66', book: 67 })

    harness.controller.selectVersion('LSG')

    expect(harness.filters()).toMatchObject({
      selectedVersion: 'LSG',
      canon: 'protestant-66',
      book: 0,
    })
  })

  it('does not write or persist when the selected version transition is unchanged', () => {
    const harness = createHarness({ selectedVersion: '' })

    harness.controller.selectVersion('')

    expect(harness.writeSelectedVersion).not.toHaveBeenCalled()
    expect(harness.persist).not.toHaveBeenCalled()
  })

  it('never allows the final search source to be disabled', () => {
    const harness = createHarness({
      itemFilters: {
        ...Object.fromEntries(Object.keys(allItemFilters).map(key => [key, false])),
        passages: true,
      } as SearchFilters['itemFilters'],
    })

    expect(harness.controller.toggleItemFilter('passages')).toBe(false)
    expect(harness.filters().itemFilters.passages).toBe(true)
  })

  it('resets every passage filter through one persisted command', () => {
    const harness = createHarness({
      section: 'nt',
      canon: 'catholic-73',
      book: 43,
      selectedVersion: 'KJV',
      sortOrder: 'book',
    })

    harness.controller.resetPassageFilters()

    expect(harness.filters()).toMatchObject({
      section: '',
      canon: '',
      book: 0,
      selectedVersion: DEFAULT_BIBLE_VERSION_FILTER,
      sortOrder: 'relevance',
    })
  })
})
