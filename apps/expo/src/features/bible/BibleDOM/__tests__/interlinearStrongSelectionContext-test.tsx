import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'

import type { BibleReaderSettings } from '../../bibleReaderSettings'
import type { ReaderIntentMessage } from '../../readerIntent/types'
import { ReaderIntentProvider } from '../useReaderIntent'
import ReverseInterlinearVerse from '../ReverseInterlinearVerse'
import StructuredInterlinearVerse from '../StructuredInterlinearVerse'

jest.mock('~features/app-switcher/utils/useResponsiveWorkspace', () => ({
  useResponsiveWorkspace: () => false,
}))

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
} as unknown as BibleReaderSettings

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
    const onReaderIntent = jest.fn(
      async (_message: ReaderIntentMessage) => ({ status: 'done' }) as const
    )
    let renderer: ReactTestRenderer

    act(() => {
      renderer = create(
        <ReaderIntentProvider
          tabId="tab-1"
          onReaderIntent={onReaderIntent}
          onPageSignal={jest.fn()}
        >
          <ReverseInterlinearVerse
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
        </ReaderIntentProvider>
      )
    })

    act(() => {
      renderer!.root.findByType('button').props.onClick()
    })

    expect(onReaderIntent).toHaveBeenCalledWith({
      tabId: 'tab-1',
      intent: {
        kind: 'open',
        origin: 'text',
        verseKey: '18-3-2',
        version: 'LSG',
        target: expect.objectContaining({
          kind: 'strong-word',
          identities: [{ kind: 'strong', code: 'H0347' }],
        }),
      },
    })
    const intent = onReaderIntent.mock.calls[0]?.[0].intent
    expect(intent?.kind === 'open' && intent.target).not.toHaveProperty('word')
  })

  it('keeps the actual Bible book when a BHG interlinear token is opened from Job', () => {
    const onReaderIntent = jest.fn(
      async (_message: ReaderIntentMessage) => ({ status: 'done' }) as const
    )
    let renderer: ReactTestRenderer

    act(() => {
      renderer = create(
        <ReaderIntentProvider
          tabId="tab-1"
          onReaderIntent={onReaderIntent}
          onPageSignal={jest.fn()}
        >
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
        </ReaderIntentProvider>
      )
    })

    act(() => {
      renderer!.root.findByType('button').props.onClick()
    })

    expect(onReaderIntent).toHaveBeenCalledWith({
      tabId: 'tab-1',
      intent: expect.objectContaining({
        kind: 'open',
        origin: 'text',
        verseKey: '18-3-2',
        version: 'BHG',
        target: expect.objectContaining({
          kind: 'strong-word',
          identities: [{ kind: 'strong', code: 'H0347' }],
        }),
      }),
    })
  })
})
