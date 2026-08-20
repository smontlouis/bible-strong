import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { atom, getDefaultStore } from 'jotai/vanilla'

import type { StrongTab } from '~state/tabs'
import LexiqueScreen from '../LexiqueScreen'
import StrongTabScreen from '../StrongTabScreen'

const mockPushRouteOnce = jest.fn()

jest.mock('~navigation/usePushRouteOnce', () => ({
  usePushRouteOnce: () => mockPushRouteOnce,
}))

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

jest.mock('../LexiqueListScreen', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return (props: Record<string, unknown>) => ReactModule.createElement('LexiqueListScreen', props)
})

jest.mock('../StrongMainScreen', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return (props: Record<string, unknown>) => ReactModule.createElement('StrongMainScreen', props)
})

describe('lexicon navigation mode', () => {
  let renderer: ReactTestRenderer
  let consoleError: jest.SpyInstance

  beforeEach(() => {
    mockPushRouteOnce.mockClear()
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    act(() => renderer?.unmount())
    consoleError.mockRestore()
  })

  it('pushes a Strong detail route from the normal lexicon page', () => {
    act(() => {
      renderer = create(<LexiqueScreen />)
    })

    const list = renderer.root.find(node => String(node.type) === 'LexiqueListScreen')
    expect(list.props).not.toHaveProperty('strongAtom')
    expect(list.props.onStrongSelect).toEqual(expect.any(Function))

    act(() => list.props.onStrongSelect(1, 'H0310A'))

    expect(mockPushRouteOnce).toHaveBeenNthCalledWith(1, {
      pathname: '/strong',
      params: {
        book: '1',
        identityCode: 'H0310A',
        identityKind: 'dstrong',
        reference: 'H0310A',
      },
    })

    act(() => list.props.onStrongSelect(1, 'H0413'))

    expect(mockPushRouteOnce).toHaveBeenNthCalledWith(2, {
      pathname: '/strong',
      params: {
        book: '1',
        identityCode: 'H0413',
        identityKind: 'strong',
        reference: 'H0413',
      },
    })
  })

  it('only mutates Strong tab state from the lexicon list', () => {
    const strongAtom = atom<StrongTab>({
      id: 'strong-tab',
      title: 'après',
      isRemovable: true,
      type: 'strong',
      data: {
        book: 1,
        reference: 'H0310A',
        identityKind: 'dstrong',
        identityCode: 'H0310A',
        bibleVersion: 'LSG',
        strongBibleVersionId: 'LSG',
        clickedWord: 'après',
        morphologyCodes: ['HNcmsa'],
      },
    })

    act(() => {
      renderer = create(<StrongTabScreen strongAtom={strongAtom} />)
    })

    const detail = renderer.root.find(node => String(node.type) === 'StrongMainScreen')
    expect(detail.props).not.toHaveProperty('onStrongSelect')
    expect(detail.props.hasBackButton).toBe(false)

    act(() => detail.props.onBack())

    const list = renderer.root.find(node => String(node.type) === 'LexiqueListScreen')
    expect(list.props.onStrongSelect).toEqual(expect.any(Function))

    act(() => list.props.onStrongSelect(40, 'G0002'))

    expect(getDefaultStore().get(strongAtom).data).toEqual({
      book: 40,
      reference: 'G0002',
    })
  })
})
