import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'

import CompareStrongVerseText from '../CompareStrongVerseText'

jest.mock('react-redux', () => ({
  useSelector: () => 0,
}))

jest.mock('~common/ui/Paragraph', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return {
    __esModule: true,
    default: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      ReactModule.createElement('Paragraph', props, children),
  }
})

jest.mock('~common/ui/Text', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return {
    __esModule: true,
    default: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      ReactModule.createElement('Text', props, children),
  }
})

describe('CompareStrongVerseText', () => {
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

  it('shows every STEP identity and sends the full word context to the Strong sheet', () => {
    const onStrongSelect = jest.fn()
    act(() => {
      renderer = create(
        <CompareStrongVerseText
          version="LSG"
          onStrongSelect={onStrongSelect}
          verse={{
            Livre: 2,
            Chapitre: 1,
            Verset: 1,
            Texte: 'Voici les noms',
            StrongSpans: [
              {
                ordinal: 0,
                startOffset: 0,
                length: 5,
                identities: [
                  { kind: 'strong', code: 'H0428' },
                  { kind: 'dstrong', code: 'H9002' },
                ],
                morphologies: [{ identity: { kind: 'strong', code: 'H0428' }, codes: ['H:DemP'] }],
              },
            ],
          }}
        />
      )
    })

    const serialized = JSON.stringify(renderer.toJSON())
    expect(serialized).toContain('H0428')
    expect(serialized).toContain('H9002')
    const strongWord = renderer.root.findAll(
      node => String(node.type) === 'Text' && typeof node.props.onPress === 'function'
    )[0]
    act(() => strongWord.props.onPress())

    expect(onStrongSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        book: 2,
        version: 'LSG',
        word: 'Voici',
        identities: expect.arrayContaining([
          { kind: 'strong', code: 'H0428' },
          { kind: 'dstrong', code: 'H9002' },
        ]),
        morphologies: expect.arrayContaining([
          { identity: { kind: 'strong', code: 'H0428' }, codes: ['H:DemP'] },
        ]),
      })
    )
  })
})
