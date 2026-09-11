jest.mock('~helpers/atomWithAsyncStorage', () => ({ __esModule: true, default: () => ({}) }))
import { normalizeSearchItemFilters } from '../searchFilters'

const filters = {
  passages: false,
  notes: true,
  links: false,
  studies: false,
  strong: false,
  dictionary: false,
  nave: false,
}
it('preserves a legacy single-source selection without enabling catalog sources', () => {
  expect(
    Object.entries(normalizeSearchItemFilters(filters))
      .filter(([, value]) => value)
      .map(([key]) => key)
  ).toEqual(['notes'])
})
it('moves the removed discovery toolbar state into the existing source filters', () => {
  expect(
    Object.entries(normalizeSearchItemFilters(filters, 'timeline'))
      .filter(([, value]) => value)
      .map(([key]) => key)
  ).toEqual(['timeline'])
  expect(normalizeSearchItemFilters(filters, 'passage').passages).toBe(true)
})

it('merges the temporary reference-only filter into Passages', () => {
  const migrated = normalizeSearchItemFilters({ ...filters, notes: false, references: true })
  expect(migrated.passages).toBe(true)
  expect(migrated).not.toHaveProperty('references')
})
