import { getChapterEntitiesViewMode } from '../chapterEntitiesPresentation'

describe('getChapterEntitiesViewMode', () => {
  it('shows the download card when contextual information is enabled but entities are missing', () => {
    expect(getChapterEntitiesViewMode('missing', false, 0)).toBe('download')
  })

  it('waits for entities when the module is available', () => {
    expect(getChapterEntitiesViewMode('available', false, 0)).toBe('hidden')
  })

  it('shows the empty state only after an available chapter has loaded', () => {
    expect(getChapterEntitiesViewMode('available', true, 0)).toBe('empty')
  })

  it('stays hidden when contextual information is disabled or availability is unresolved', () => {
    expect(getChapterEntitiesViewMode(null, false, 0)).toBe('hidden')
  })
})
