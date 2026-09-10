import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import type { Bookmark } from '~common/types'
import ResumeBookmark from '../ResumeBookmark'

let mockBookmark: Bookmark | undefined
const mockPushRoute = jest.fn()
jest.mock('react-redux', () => ({ useSelector: () => mockBookmark }))
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
jest.mock('~navigation/usePushRouteOnce', () => ({ usePushRouteOnce: () => mockPushRoute }))
jest.mock('~common/Link', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return {
    LinkBox: (props: Record<string, unknown>) => ReactModule.createElement('LinkBox', props),
  }
})
jest.mock('~common/ui/Box', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return (props: Record<string, unknown>) => ReactModule.createElement('Box', props)
})
jest.mock('~common/ui/Text', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return (props: Record<string, unknown>) => ReactModule.createElement('Text', props)
})
jest.mock('~common/ui/Icon', () => ({ FeatherIcon: () => null, IonIcon: () => null }))

describe.each([false, true])('ResumeBookmark card=%s', card => {
  let tree: ReactTestRenderer
  beforeEach(() => {
    mockPushRoute.mockClear()
    mockBookmark = undefined
  })
  afterEach(() => act(() => tree?.unmount()))

  const open = () => {
    act(() => {
      tree = create(<ResumeBookmark card={card} />)
    })
    act(() => tree.root.findByType('LinkBox' as React.ElementType).props.onPress())
  }

  it('opens the Bible without overriding defaults when there is no bookmark', () => {
    open()
    expect(mockPushRoute).toHaveBeenCalledWith({ pathname: '/bible-view', params: undefined })
  })

  it('resumes the bookmarked verse in its saved version', () => {
    mockBookmark = {
      id: 'latest',
      name: 'Lecture',
      color: '#fff',
      book: 19,
      chapter: 68,
      verse: 4,
      version: 'BDS',
      date: 200,
    }
    open()
    expect(mockPushRoute).toHaveBeenCalledWith({
      pathname: '/bible-view',
      params: {
        contextDisplayMode: 'focused',
        book: '19',
        chapter: '68',
        verse: '4',
        version: 'BDS',
      },
    })
  })

  it('leaves verse and version unspecified for a chapter bookmark without a version', () => {
    mockBookmark = { id: 'latest', name: 'Lecture', color: '#fff', book: 1, chapter: 8, date: 200 }
    open()
    expect(mockPushRoute).toHaveBeenCalledWith({
      pathname: '/bible-view',
      params: { contextDisplayMode: 'focused', book: '1', chapter: '8' },
    })
  })
})
