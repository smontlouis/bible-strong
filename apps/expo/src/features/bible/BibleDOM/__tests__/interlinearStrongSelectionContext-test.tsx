import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'

import type { RootState } from '~redux/modules/reducer'
import { DispatchProvider } from '../DispatchProvider'
import { OPEN_STRONG_SELECTION } from '../dispatch'
import ReverseInterlinearVerse from '../ReverseInterlinearVerse'
import StructuredInterlinearVerse from '../StructuredInterlinearVerse'

const settings = {
  theme: 'default',
  colors: {
    default: {
      default: '#111',
      primary: '#5686ed',
      reverse: '#fff',
      tertiary: '#667',
      lightPrimary: '#edf2ff',
    },
  },
  fontFamily: 'Arial',
  fontSizeScale: 1,
} as RootState['user']['bible']['settings']

describe('interlinear Strong selection context', () => {
  let consoleError: jest.SpiedFunction<typeof console.error>

  beforeAll(() => {
    ;(
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true
    consoleError = jest.spyOn(console, 'error').mockImplementation((message, ...args) => {
      if (typeof message === 'string' && message.startsWith('react-test-renderer is deprecated')) {
        return
      }
      console.warn(message, ...args)
    })
  })

  afterAll(() => {
    consoleError.mockRestore()
  })

  it('keeps the actual Bible book when an untranslated Strong is opened from Job', () => {
    const dispatch = jest.fn()
    let renderer: ReactTestRenderer

    act(() => {
      renderer = create(
        <DispatchProvider dispatch={dispatch}>
          <ReverseInterlinearVerse
            isParallel={false}
            settings={settings}
            version="LSG"
            verse={{
              Livre: 18,
              Chapitre: 3,
              Verset: 2,
              Texte: 'Il prit la parole et dit :',
              ReverseInterlinearSpans: [
                {
                  ordinal: 0,
                  startOffset: 2,
                  length: 0,
                  identities: [{ kind: 'strong', code: 'H0347' }],
                  sourceTokens: [],
                },
              ],
            }}
          />
        </DispatchProvider>
      )
    })

    act(() => {
      renderer!.root.findByType('button').props.onClick()
    })

    expect(dispatch).toHaveBeenCalledWith({
      type: OPEN_STRONG_SELECTION,
      payload: expect.objectContaining({
        book: 18,
        chapter: 3,
        verse: 2,
        reference: '347',
      }),
    })
    expect(dispatch.mock.calls[0]?.[0].payload).not.toHaveProperty('word')
  })

  it('keeps the actual Bible book when a BHG interlinear token is opened from Job', () => {
    const dispatch = jest.fn()
    let renderer: ReactTestRenderer

    act(() => {
      renderer = create(
        <DispatchProvider dispatch={dispatch}>
          <StructuredInterlinearVerse
            isHebreu
            mode="strong"
            settings={settings}
            version="BHG"
            verse={{
              Livre: 18,
              Chapitre: 3,
              Verset: 2,
              Texte: 'אִיּוֹב',
              InterlinearTokens: [
                {
                  ordinal: 0,
                  startOffset: 0,
                  length: 5,
                  segments: [
                    {
                      ordinal: 0,
                      startOffset: 0,
                      length: 5,
                      transliteration: "'iYov",
                      lemma: 'אִיּוֹב',
                      morphology: 'HNpm',
                      gloss: 'Job',
                      identities: [{ kind: 'strong', code: 'H0347' }],
                    },
                  ],
                },
              ],
            }}
          />
        </DispatchProvider>
      )
    })

    act(() => {
      renderer!.root.findByType('button').props.onClick()
    })

    expect(dispatch).toHaveBeenCalledWith({
      type: OPEN_STRONG_SELECTION,
      payload: expect.objectContaining({
        book: 18,
        chapter: 3,
        verse: 2,
        reference: '347',
      }),
    })
  })
})
