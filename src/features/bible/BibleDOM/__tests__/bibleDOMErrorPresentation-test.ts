import { BibleLoadingError } from '~helpers/bibleErrors'
import { getBibleDOMErrorPresentation } from '../bibleDOMErrorPresentation'

describe('Bible DOM resource failure presentation', () => {
  it.each([
    ['CHAPTER_NOT_FOUND', true, 'search'],
    ['RESOURCE_OFFLINE', false, 'wifi-off'],
    ['RESOURCE_TEMPORARY_UNAVAILABLE', true, 'cloud-off'],
  ] as const)('renders %s with the shared %s icon', (type, isConnected, icon) => {
    expect(getBibleDOMErrorPresentation(new BibleLoadingError(type, 'LSG'), isConnected).icon).toBe(
      icon
    )
  })

  it('does not expose a disconnected Bible download action', () => {
    expect(
      getBibleDOMErrorPresentation(new BibleLoadingError('BIBLE_NOT_FOUND', 'LSG'), false)
    ).toMatchObject({ icon: 'wifi-off', actions: [], connectionRequired: true })
  })
})
