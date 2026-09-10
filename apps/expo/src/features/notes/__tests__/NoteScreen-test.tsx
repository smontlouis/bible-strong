import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import NoteScreen from '../NoteScreen'
import NoteDetailTabScreen from '../NoteDetailTabScreen'

const mockRouter = { canGoBack: jest.fn(), back: jest.fn(), replace: jest.fn() }
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({ noteId: '65-1-24', verseKeys: '["1-1-1"]', version: 'LSG' }),
}))
jest.mock('~helpers/constants', () => ({ IS_FORM_SHEET: true }))
jest.mock('~navigation/pageTransition', () => ({
  navigateWithPageTransition: (_path: string, navigate: () => void) => navigate(),
}))
jest.mock('../NoteDetailTabScreen', () => ({ __esModule: true, default: () => null }))

let tree: ReactTestRenderer
beforeEach(() => jest.clearAllMocks())
afterEach(() => {
  act(() => tree.unmount())
})

it.each([false, true])(
  'the actual note route back callback handles available history: %s',
  canGoBack => {
    mockRouter.canGoBack.mockReturnValue(canGoBack)
    act(() => {
      tree = create(<NoteScreen />)
    })
    const detail = tree.root.findByType(NoteDetailTabScreen)
    expect(detail.props.noteId).toBe('65-1-24')
    expect(detail.props.initialVerseKeys).toEqual(['1-1-1'])
    expect(detail.props.initialVersion).toBe('LSG')
    act(() => detail.props.onBackPress())
    if (canGoBack) {
      expect(mockRouter.back).toHaveBeenCalledTimes(1)
      expect(mockRouter.replace).not.toHaveBeenCalled()
    } else {
      expect(mockRouter.back).not.toHaveBeenCalled()
      expect(mockRouter.replace).toHaveBeenCalledWith('/')
    }
  }
)
