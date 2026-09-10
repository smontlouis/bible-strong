/** @jest-environment jsdom */
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { createStore, Provider } from 'jotai'
import { confirmRequestsAtom } from '~common/ConfirmDialog/state'
import StudySettingsModal from '../StudySettingsModal'

const mockDispatch = jest.fn()
jest.mock('react-redux', () => ({
  useDispatch: () => mockDispatch,
  useSelector: () => ({ id: 'test-study', title: 'Test study' }),
}))
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
jest.mock('~common/ConfirmDialog/useConfirmDialog', () =>
  jest.requireActual('../../../common/ConfirmDialog/useConfirmDialog.web')
)
jest.mock('~common/ContextualPanel/ContextualSheet', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
jest.mock('~common/ActionMenu', () => ({
  ActionSheetItem: ({ label, onPress }: { label: string; onPress: () => void }) => (
    <button onClick={onPress}>{label}</button>
  ),
}))
jest.mock('../PublishStudyMenuItem', () => () => null)
jest.mock('~features/app-switcher/utils/useOpenInNewTab', () => ({
  useOpenInNewTab: () => jest.fn(),
}))
jest.mock('~helpers/generateUUID', () => () => 'test-id')
jest.mock('~redux/modules/user', () => ({
  deleteStudy: (id: string) => ({ type: 'deleteStudy', payload: id }),
}))
jest.mock('~state/app', () => ({ unifiedTagsModalAtom: require('jotai').atom(null) }))

describe('Study deletion on web', () => {
  let root: Root
  let host: HTMLDivElement
  beforeEach(() => {
    ;(
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true
    mockDispatch.mockClear()
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  })
  afterEach(() => {
    act(() => root.unmount())
    host.remove()
  })

  it.each([false, true])('waits for confirmation and honors the answer (%s)', async confirmed => {
    const store = createStore()
    const dismiss = jest.fn()
    act(() => {
      root.render(
        <Provider store={store}>
          <StudySettingsModal
            ref={{
              current: {
                dismiss,
                present: jest.fn(),
                presentAt: jest.fn(),
                resizeTo: jest.fn(),
                close: jest.fn(),
                forceClose: jest.fn(),
              },
            }}
            studyId="test-study"
            onClosed={jest.fn()}
            openRenameModal={jest.fn()}
          />
        </Provider>
      )
    })
    const remove = Array.from(host.querySelectorAll('button')).find(
      button => button.textContent === 'Supprimer'
    )!
    act(() => remove.click())
    expect(mockDispatch).not.toHaveBeenCalled()
    expect(dismiss).not.toHaveBeenCalled()
    const requests = store.get(confirmRequestsAtom)
    expect(requests).toHaveLength(1)
    expect(requests[0].options.destructive).toBe(true)
    await act(async () => requests[0].resolve(confirmed))
    if (confirmed) {
      expect(mockDispatch).toHaveBeenCalledWith({ type: 'deleteStudy', payload: 'test-study' })
      expect(dismiss).toHaveBeenCalledTimes(1)
    } else {
      expect(mockDispatch).not.toHaveBeenCalled()
      expect(dismiss).not.toHaveBeenCalled()
    }
  })
})
