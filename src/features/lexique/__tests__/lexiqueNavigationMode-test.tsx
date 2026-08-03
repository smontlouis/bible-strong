import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { atom, getDefaultStore } from 'jotai/vanilla'

import type { StrongTab } from '~state/tabs'
import LexiqueScreen from '../LexiqueScreen'
import StrongTabScreen from '../StrongTabScreen'

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
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    act(() => renderer?.unmount())
    consoleError.mockRestore()
  })

  it('does not create or pass Strong tab state from the normal lexicon page', () => {
    act(() => {
      renderer = create(<LexiqueScreen />)
    })

    const list = renderer.root.find(node => String(node.type) === 'LexiqueListScreen')
    expect(list.props).not.toHaveProperty('strongAtom')
    expect(list.props.onStrongSelect).toBeUndefined()
  })

  it('injects Strong state mutation only from a Strong tab', () => {
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

    const onStrongSelect = renderer.root.find(node => String(node.type) === 'StrongMainScreen')
      .props.onStrongSelect
    expect(onStrongSelect).toEqual(expect.any(Function))

    act(() => onStrongSelect(40, 'G0002'))

    expect(getDefaultStore().get(strongAtom).data).toEqual({
      book: 40,
      reference: 'G0002',
      bibleVersion: 'LSG',
      strongBibleVersionId: 'LSG',
    })
  })
})
