import React, { act } from 'react'
import { create, type ReactTestRenderer } from 'react-test-renderer'
import { useBibleBookmarkScreens } from '../useBibleBookmarkScreens'

const mockDispatch = jest.fn()
jest.mock('react-redux', () => ({ useDispatch: () => mockDispatch, useSelector: () => [] }))
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
jest.mock('~redux/modules/user', () => ({
  MAX_BOOKMARKS: 8,
  addBookmark: (payload: unknown) => ({ type: 'add', payload }),
}))
jest.mock('~redux/selectors/bookmarks', () => ({ selectSortedBookmarks: jest.fn() }))
jest.mock('~common/ContextualPanel/useConfirmDelete', () => ({ useConfirmDelete: () => jest.fn() }))
jest.mock('~helpers/toast', () => ({ toast: jest.fn() }))
jest.mock('../BookmarkForm', () => ({ __esModule: true, default: 'BookmarkForm' }))
jest.mock('~common/ContextualPanel/PanelAction', () => ({ __esModule: true, default: 'Action' }))
jest.mock('~common/ui/Text', () => ({ __esModule: true, default: 'Text' }))
jest.mock('~common/ui/Box', () => ({ __esModule: true, default: 'Box', TouchableBox: 'Button' }))
jest.mock('~common/ui/Icon', () => ({ FeatherIcon: 'Icon', IonIcon: 'Icon' }))

it.each([undefined, 7])('creates a bookmark at the requested location (verse %s)', verse => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  mockDispatch.mockClear()
  let panel: ReturnType<typeof useBibleBookmarkScreens>
  function Probe() {
    panel = useBibleBookmarkScreens(2, 3, 'LSG', verse)
    return null
  }
  let view: ReactTestRenderer
  let form: ReactTestRenderer
  const close = jest.fn()
  act(() => {
    view = create(<Probe />)
  })
  act(() => {
    form = create(
      <>{panel.screens['bookmark-create'].content({ close, open: jest.fn(), back: jest.fn() })}</>
    )
  })
  act(() => form!.root.findByType('BookmarkForm' as React.ElementType).props.onSave())
  expect(mockDispatch).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'add',
      payload: expect.objectContaining({ book: 2, chapter: 3, version: 'LSG', verse }),
    })
  )
  expect(close).toHaveBeenCalledTimes(1)
  act(() => {
    view!.unmount()
    form!.unmount()
  })
})
