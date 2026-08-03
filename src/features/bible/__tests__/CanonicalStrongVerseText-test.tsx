import React from 'react'

import CanonicalStrongVerseText from '../CanonicalStrongVerseText'

jest.mock('~common/ui/Paragraph', () => {
  const mockReact = jest.requireActual<typeof import('react')>('react')
  return {
    __esModule: true,
    default: ({ children }: React.PropsWithChildren) =>
      mockReact.createElement(mockReact.Fragment, null, children),
  }
})

jest.mock('../BibleStrongReference', () => {
  const mockReact = jest.requireActual<typeof import('react')>('react')
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) =>
      mockReact.createElement('mock-strong-reference', props),
  }
})

describe('CanonicalStrongVerseText', () => {
  it('keeps every effective identity interactive on a multi-identity span', () => {
    const textStyle = { fontSize: 24, lineHeight: 24 }
    const rendered = CanonicalStrongVerseText({
      verse: {
        Livre: 1,
        Texte: 'L’Éternel',
        StrongSpans: [
          {
            ordinal: 0,
            startOffset: 0,
            length: 9,
            identities: [
              { kind: 'dstrong', code: 'H3068G' },
              { kind: 'strong', code: 'H0413' },
            ],
          },
        ],
      },
      textStyle,
    }) as React.ReactElement<{
      reference: string
      word?: string
      textStyle?: { fontSize: number; lineHeight: number }
      occurrenceIndex: number
      selectionTargets?: Array<{ reference: string; occurrenceIndex: number }>
    }>[]

    expect(rendered).toHaveLength(1)
    expect(rendered[0].props).toEqual(
      expect.objectContaining({
        reference: '3068',
        word: 'L’Éternel',
        textStyle,
        occurrenceIndex: 0,
        selectionTargets: [
          { reference: '3068', occurrenceIndex: 0 },
          { reference: '413', occurrenceIndex: 1 },
        ],
      })
    )
  })
})
