import { COMMENTARY_CATALOG_BY_ID } from '@bible-strong/resource-catalog/commentaries'

import {
  COMMENTARY_CURRENTS,
  COMMENTARY_TRADITIONS,
  matchesCommentaryTaxonomyFilters,
  toggleCommentaryTaxonomyFilter,
} from '../commentaryCatalogFilters'

const entry = (id: string) => COMMENTARY_CATALOG_BY_ID.get(id)!

describe('commentary catalog filters', () => {
  it('exposes every tradition and current once in alphabetical order', () => {
    expect(COMMENTARY_TRADITIONS).toEqual([
      'Catholicisme',
      'Christianisme ancien',
      'Judaïsme',
      'Protestantisme',
    ])
    expect(new Set(COMMENTARY_CURRENTS).size).toBe(COMMENTARY_CURRENTS.length)
    expect(COMMENTARY_CURRENTS).toContain('Réformé')
    expect(COMMENTARY_CURRENTS).toContain('Méthodiste')
  })

  it('uses OR within currents and AND between tradition and current', () => {
    const currents = ['Réformé', 'Méthodiste']

    expect(matchesCommentaryTaxonomyFilters(entry('barnes'), ['Protestantisme'], currents)).toBe(
      true
    )
    expect(matchesCommentaryTaxonomyFilters(entry('acbc'), ['Protestantisme'], currents)).toBe(true)
    expect(
      matchesCommentaryTaxonomyFilters(entry('bible-annotee'), ['Catholicisme'], currents)
    ).toBe(false)
    expect(
      matchesCommentaryTaxonomyFilters(entry('douay-rheims-notes'), ['Catholicisme'], currents)
    ).toBe(false)
  })

  it('treats an empty category as unrestricted', () => {
    expect(matchesCommentaryTaxonomyFilters(entry('sdabc'), [], [])).toBe(true)
    expect(matchesCommentaryTaxonomyFilters(entry('sdabc'), [], ['Adventiste'])).toBe(true)
  })

  it('toggles values without duplicates', () => {
    expect(toggleCommentaryTaxonomyFilter([], 'Réformé')).toEqual(['Réformé'])
    expect(toggleCommentaryTaxonomyFilter(['Réformé'], 'Réformé')).toEqual([])
  })
})
