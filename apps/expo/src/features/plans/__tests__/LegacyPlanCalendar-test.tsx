import React from 'react'
import { act, create } from 'react-test-renderer'
import Menu from '../PlanScreen/Menu'
const mockDispatch = jest.fn()
const mockParticipation = { id: 'legacy', status: 'Progress', readingSlices: { day1: 'Completed' } }
jest.mock('react-native', () => ({ Platform: { OS: 'web' } }))
jest.mock('react-redux', () => ({
  useDispatch: () => mockDispatch,
  useSelector: (selector: Function) => selector({ plan: { ongoingPlans: [mockParticipation] } }),
}))
jest.mock('expo-router', () => ({ useRouter: () => ({}) }))
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
jest.mock('~common/ConfirmDialog/useConfirmDialog', () => ({ useConfirmDialog: () => jest.fn() }))
jest.mock('~features/app-switcher/utils/useOpenInNewTab', () => ({
  useOpenInNewTab: () => jest.fn(),
}))
jest.mock('~navigation/goBackOrHome', () => ({ goBackOrHome: jest.fn() }))
jest.mock('~helpers/generateUUID', () => jest.fn())
jest.mock('~common/sheet', () => ({ SheetView: 'SheetView' }))
jest.mock('~common/ModalSheet', () => 'Sheet')
jest.mock('~common/ui/Box', () => 'Box')
jest.mock('~common/ui/Button', () => 'Button')
jest.mock('~common/ui/Icon', () => ({ FeatherIcon: 'Icon' }))
jest.mock('~common/ContextualPanel/ContextualMenu', () => 'Menu')
jest.mock('~features/daily-reading/ReminderSettings', () => 'Reminder')
jest.mock('~features/daily-reading/ReadingDatePicker', () => 'DatePicker')
jest.mock('~features/daily-reading/useDailyMeditation', () => ({
  useLocalReadingDate: () => '2026-09-15',
}))
jest.mock('~redux/modules/plan', () => ({
  startPlan: (payload: unknown) => ({ type: 'start', payload }),
}))

it('lets a legacy participation explicitly choose today without resetting its readings', () => {
  let tree: ReturnType<typeof create>
  act(() => {
    tree = create(<Menu modalRefDetails={{ current: null }} planId="legacy" title="Legacy" />)
  })
  const menu = tree!.root.find(node => String(node.type) === 'Menu')
  expect(menu.props.actions.some((action: { id: string }) => action.id === 'start-date')).toBe(true)
  expect(menu.props.actions.some((action: { id: string }) => action.id === 'reminder')).toBe(false)
  expect(mockDispatch).not.toHaveBeenCalled()
  const button = tree!.root.find(node => String(node.type) === 'Button')
  act(() => button.props.onPress())
  expect(mockDispatch).toHaveBeenCalledWith({
    type: 'start',
    payload: { planId: 'legacy', startDate: '2026-09-15' },
  })
  expect(mockParticipation.readingSlices).toEqual({ day1: 'Completed' })
  act(() => tree!.unmount())
})
