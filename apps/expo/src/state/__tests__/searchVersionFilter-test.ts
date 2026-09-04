import { DEFAULT_BIBLE_VERSION_FILTER, resolveSearchVersionFilter } from '../searchVersionFilter'

describe('search version filter', () => {
  it('follows the current user default Bible', () => {
    expect(resolveSearchVersionFilter(DEFAULT_BIBLE_VERSION_FILTER, 'LSG')).toBe('LSG')
    expect(resolveSearchVersionFilter(DEFAULT_BIBLE_VERSION_FILTER, 'S21')).toBe('S21')
  })

  it('keeps an explicit version when the user default changes', () => {
    expect(resolveSearchVersionFilter('LSG', 'S21')).toBe('LSG')
  })
})
