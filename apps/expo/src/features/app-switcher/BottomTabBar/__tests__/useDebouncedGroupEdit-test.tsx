import React, { act } from 'react'
import { create, type ReactTestRenderer } from 'react-test-renderer'
import { useDebouncedGroupEdit } from '../useDebouncedGroupEdit'

beforeEach(() => {
  jest.useFakeTimers()
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
})
afterEach(() => jest.useRealTimers())

it('debounces typing and immediately saves colors without losing the pending name', () => {
  const save = jest.fn()
  let edit: ReturnType<typeof useDebouncedGroupEdit>
  function Probe() {
    edit = useDebouncedGroupEdit({ id: 'g1', name: 'Old', color: 'red' }, save)
    return null
  }
  let view: ReactTestRenderer
  act(() => {
    view = create(<Probe />)
  })
  act(() => edit.changeName('New'))
  act(() => jest.advanceTimersByTime(299))
  expect(save).not.toHaveBeenCalled()
  act(() => jest.advanceTimersByTime(1))
  expect(save).toHaveBeenLastCalledWith({ groupId: 'g1', name: 'New', color: 'red' })
  act(() => {
    edit.changeName('Newest')
    edit.changeColor('blue')
  })
  expect(save).toHaveBeenLastCalledWith({ groupId: 'g1', name: 'Newest', color: 'blue' })
  act(() => jest.runAllTimers())
  expect(save).toHaveBeenCalledTimes(2)
  act(() => view!.unmount())
})

it('flushes the last keystroke on close or unmount and never saves an empty name', () => {
  const save = jest.fn()
  let edit: ReturnType<typeof useDebouncedGroupEdit>
  function Probe() {
    edit = useDebouncedGroupEdit({ id: 'g1', name: 'Old', color: 'red' }, save)
    return null
  }
  let view: ReactTestRenderer
  act(() => {
    view = create(<Probe />)
  })
  act(() => {
    edit.changeName('Final')
    edit.flush()
  })
  expect(save).toHaveBeenLastCalledWith({ groupId: 'g1', name: 'Final', color: 'red' })
  act(() => {
    edit.changeName('  ')
    jest.runAllTimers()
  })
  expect(save).toHaveBeenCalledTimes(1)
  act(() => edit.changeName('Unmounted'))
  act(() => view!.unmount())
  expect(save).toHaveBeenLastCalledWith({ groupId: 'g1', name: 'Unmounted', color: 'red' })
  act(() => jest.runAllTimers())
  expect(save).toHaveBeenCalledTimes(2)
})
