import React from 'react'
import { act, create } from 'react-test-renderer'
import ReadButton from '../PlanSliceScreen/ReadButton'
const mockDispatch = jest.fn()
jest.mock('react-redux', () => ({ useDispatch: () => mockDispatch }))
jest.mock('expo-router', () => ({ useRouter: () => ({}) }))
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
jest.mock('~themes/ThemeProvider', () => ({ useTheme: () => ({ colors: { default: '#000' } }) }))
jest.mock('~common/Link', () => 'Link')
jest.mock('~common/ui/Icon', () => ({ MaterialIcon: 'Icon' }))
jest.mock('~redux/modules/plan', () => ({
  markAsRead: (payload: unknown) => ({ type: 'read', payload }),
}))
jest.mock('~navigation/goBackOrHome', () => ({ goBackOrHome: jest.fn() }))

it.each([false, true])(
  'finishes a reading without toggling completed progress (read=%s)',
  isRead => {
    mockDispatch.mockClear()
    const onRead = jest.fn()
    let tree: ReturnType<typeof create>
    act(() => {
      tree = create(
        <ReadButton readingSliceId="day-1" planId="plan" isRead={isRead} onRead={onRead} />
      )
    })
    const button = tree!.root.find(node => String(node.type) === 'Link')
    expect(button.props.accessibilityLabel).toBe(isRead ? 'Retour' : 'Marquer comme lu')
    act(() => button.props.onPress())
    expect(mockDispatch).toHaveBeenCalledTimes(isRead ? 0 : 1)
    expect(onRead).toHaveBeenCalledTimes(1)
    act(() => tree!.unmount())
  }
)
