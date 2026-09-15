import {
  defaultReadingPlanFilters,
  filterReadingPlans,
  resolveReadingPlanFilters,
} from '../readingPlanFilters'

it('resolves explicit route filters and falls back safely for invalid language values', () => {
  expect(resolveReadingPlanFilters({ language: 'all', search: 'prière' }, 'fr')).toEqual({
    language: 'all',
    query: 'prière',
  })
  expect(resolveReadingPlanFilters({ language: ['en'], search: ['prayer'] }, 'fr')).toEqual({
    language: 'en',
    query: 'prayer',
  })
  expect(resolveReadingPlanFilters({ language: 'unknown' }, 'en-US')).toEqual({
    language: 'en',
    query: '',
  })
})

const plans = [
  {
    id: 'fr',
    lang: 'fr' as const,
    title: 'Dix jours de prière',
    description: 'Un parcours de foi',
  },
  { id: 'en', lang: 'en' as const, title: 'Ten days of prayer' },
]

it('defaults to the user language and requires an explicit choice to show other languages', () => {
  expect(filterReadingPlans(plans, defaultReadingPlanFilters('fr')).map(plan => plan.id)).toEqual([
    'fr',
  ])
  expect(
    filterReadingPlans(plans, defaultReadingPlanFilters('en-US')).map(plan => plan.id)
  ).toEqual(['en'])
  expect(filterReadingPlans(plans, { query: '', language: 'all' })).toEqual(plans)
})

it('combines language with case- and accent-insensitive search', () => {
  expect(
    filterReadingPlans(plans, { query: 'PRIERE foi', language: 'fr' }).map(plan => plan.id)
  ).toEqual(['fr'])
  expect(filterReadingPlans(plans, { query: 'prayer', language: 'fr' })).toEqual([])
  expect(
    filterReadingPlans(plans, { query: 'prayer', language: 'en' }).map(plan => plan.id)
  ).toEqual(['en'])
})
